"""Authentication endpoints. Public ones declare their own throttles and no authenticators."""

import logging
from dataclasses import dataclass, replace
from typing import Any, cast

from django.contrib.auth import login, logout
from django.db.models import QuerySet
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.debug import sensitive_variables
from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema
from kombu.exceptions import OperationalError
from rest_framework import mixins, status, viewsets
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.audit import AuditContext, AuthEvent, fingerprint, log_auth_event
from accounts.authentication import DeviceBearerAuthentication
from accounts.exceptions import (
    DeviceOrganizationMismatchError,
    DeviceRevokedError,
    InvalidCredentialsError,
)
from accounts.models import Device, DeviceSession, Personnel, RevokeReason, User
from accounts.permissions import DEVICE_READ, DEVICE_REVOKE, USER_REVOKE_DEVICE_SESSIONS
from accounts.personnel_selectors import scoped_personnel
from accounts.personnel_services import revoke_scoped_personnel_sessions
from accounts.personnel_views import PersonnelViewSet
from accounts.request_context import organization_header
from accounts.revocation import Revocation, revoke_device, revoke_session
from accounts.selectors import list_devices, users_of_organization, with_searchable_device_user
from accounts.serializers import (
    DeviceFilterSerializer,
    DeviceSerializer,
    LoginSerializer,
    MobileLoginResponseSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RefreshResponseSerializer,
    RefreshSerializer,
    RevokedSessionsSerializer,
    RevokeRequestSerializer,
    WebLoginResponseSerializer,
)
from accounts.services import (
    DeviceInfo,
    authenticate_user,
    change_password,
    reset_password,
    start_device_session,
)
from accounts.tasks import send_password_reset_email
from accounts.throttling import (
    LoginIpThrottle,
    LoginUserIpThrottle,
    PasswordChangeThrottle,
    PasswordResetConfirmThrottle,
    PasswordResetThrottle,
    RefreshThrottle,
    client_ip,
)
from accounts.token_pairs import rotate_refresh_token
from core.authentication import ApiSessionAuthentication
from core.filters import CodeLookupFilter
from core.session_identity import remember_active_organization
from core.table_filters import TableOrderingFilter, TableSearchFilter
from core.time import server_now
from core.views import OrgScopedViewSetMixin
from organizations.exceptions import NoActiveMembershipError, OrganizationHeaderRequiredError
from organizations.selectors import get_me_context, resolve_active_membership
from organizations.services import effective_scope
from uploads.access import actor_from_request

logger = logging.getLogger("accounts.auth")

REDACTED_ARGS_REPR = "('<redacted>',)"

LoginResponse = PolymorphicProxySerializer(
    component_name="LoginResponse",
    serializers=[MobileLoginResponseSerializer, WebLoginResponseSerializer],
    resource_type_field_name=None,
)


# Refusals after the password was verified (the user knows the password; the log says why not).
LOGIN_REFUSALS = (
    DeviceRevokedError,
    DeviceOrganizationMismatchError,
    NoActiveMembershipError,
    OrganizationHeaderRequiredError,
    InvalidCredentialsError,  # the account changed between the check and the session
)


@dataclass(frozen=True)
class AuthenticatedLogin:
    """What a login handler needs once the credentials are verified."""

    user: User
    organization_slug: str | None
    audit: AuditContext


def enforce_csrf(request: Request) -> None:
    """Run DRF's own session CSRF check (a view without authenticators gets none by itself).

    DRF wraps every view in `csrf_exempt`, so Django's middleware never checks them: the session
    authenticator does it for logged-in users, and the login (which has no session yet) must do
    it explicitly. Fails with `403 permission_denied`.
    """
    SessionAuthentication().enforce_csrf(request)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """Sets the CSRF cookie for the web client, which sends it back as `X-CSRFToken`."""

    authentication_classes: list[Any] = []
    permission_classes = [AllowAny]

    @extend_schema(responses={204: None}, auth=[])
    def get(self, request: Request) -> Response:
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(never_cache, name="dispatch")
class LoginView(APIView):
    """`POST /auth/login/`. With `device_id`: mobile tokens. Without: a web session (CSRF)."""

    authentication_classes: list[Any] = []
    permission_classes = [AllowAny]
    throttle_classes = [LoginIpThrottle, LoginUserIpThrottle]

    @extend_schema(request=LoginSerializer, responses={200: LoginResponse}, auth=[])
    @sensitive_variables()
    def post(self, request: Request) -> Response:
        payload = LoginSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        is_mobile = "device_id" in data
        if not is_mobile:
            enforce_csrf(request)
        user = authenticate_user(data["username"], data["password"], client_ip(request))
        login_state = AuthenticatedLogin(
            user=user,
            organization_slug=organization_header(request),
            audit=AuditContext(
                user_id=user.pk,
                device_id=data.get("device_id"),
                ip=client_ip(request),
                username_fingerprint=fingerprint(data["username"]),
            ),
        )
        try:
            if is_mobile:
                return self._mobile_login(login_state, data)
            return self._web_login(request, login_state)
        except LOGIN_REFUSALS as refusal:
            # The password was right but the login is refused: say why in the log, then answer.
            log_auth_event(AuthEvent.LOGIN_REFUSED, login_state.audit, {"reason": refusal.code})
            raise

    def _mobile_login(self, state: AuthenticatedLogin, data: dict[str, Any]) -> Response:
        membership = resolve_active_membership(state.user, state.organization_slug)
        info = DeviceInfo(
            device_id=data["device_id"],
            label=data.get("label", ""),
            app_version=data.get("app_version", ""),
        )
        issued = start_device_session(state.user, membership.organization, info)
        log_auth_event(
            AuthEvent.LOGIN_SUCCEEDED,
            replace(state.audit, organization_id=membership.organization_id),
            {"channel": "mobile"},
        )
        body = {
            "access": issued.access,
            "refresh": issued.refresh,
            "me": get_me_context(state.user, membership.organization.slug),
            "server_time": server_now(),
        }
        return Response(MobileLoginResponseSerializer(body).data)

    def _web_login(self, request: Request, state: AuthenticatedLogin) -> Response:
        # 403 when there is no membership: checked before a session exists.
        me = get_me_context(state.user, state.organization_slug)
        login(request._request, state.user)
        organization = me.organization
        # The login answer attests the same identity `/me/` and every resource will carry.
        remember_active_organization(request, organization.pk if organization else None)
        log_auth_event(
            AuthEvent.LOGIN_SUCCEEDED,
            replace(state.audit, organization_id=organization.pk if organization else None),
            {"channel": "web"},
        )
        return Response(WebLoginResponseSerializer({"me": me, "server_time": server_now()}).data)


@method_decorator(never_cache, name="dispatch")
class RefreshView(APIView):
    """`POST /auth/refresh/`: rotate the token pair of a device session (mobile)."""

    authentication_classes: list[Any] = []
    permission_classes = [AllowAny]
    throttle_classes = [RefreshThrottle]

    @extend_schema(request=RefreshSerializer, responses=RefreshResponseSerializer, auth=[])
    def post(self, request: Request) -> Response:
        payload = RefreshSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        issued = rotate_refresh_token(
            payload.validated_data["refresh"], payload.validated_data["device_id"]
        )
        session = issued.session
        log_auth_event(
            AuthEvent.REFRESH,
            AuditContext(
                organization_id=session.organization_id,
                user_id=session.user_id,
                device_id=session.device_id,
                ip=client_ip(request),
            ),
        )
        body = {"access": issued.access, "refresh": issued.refresh, "server_time": server_now()}
        return Response(RefreshResponseSerializer(body).data)


@method_decorator(never_cache, name="dispatch")
class PasswordResetView(APIView):
    """`POST /auth/password-reset/ {email}`: always `202`, whether or not the account exists.

    The view neither looks the address up nor waits for the email: it enqueues a task, so the
    answer, its body and its timing are the same for every address. The worker emails the link.
    """

    authentication_classes: list[Any] = []
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    @extend_schema(request=PasswordResetRequestSerializer, responses={202: None}, auth=[])
    def post(self, request: Request) -> Response:
        payload = PasswordResetRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        email = payload.validated_data["email"]
        log_auth_event(
            AuthEvent.PASSWORD_RESET_REQUESTED,
            AuditContext(ip=client_ip(request), username_fingerprint=fingerprint(email)),
        )
        try:
            # `argsrepr` keeps the address out of worker logs and monitoring (Celery shows it
            # instead of repr(args)); the message body still carries it for the worker.
            send_password_reset_email.apply_async(args=[email], argsrepr=REDACTED_ARGS_REPR)
        except OperationalError:
            # Broker down: the answer must not tell, so it is still 202; operators see the log.
            logger.exception("event=password_reset_enqueue_failed")
        return Response(status=status.HTTP_202_ACCEPTED)


@method_decorator(never_cache, name="dispatch")
class PasswordResetConfirmView(APIView):
    """`POST /auth/password-reset/confirm/ {uid, token, new_password}`: set the new password.

    Revokes the user's device sessions (`password_changed`; no final upload). Web sessions end by
    themselves because Django ties them to the password hash.
    """

    authentication_classes: list[Any] = []
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetConfirmThrottle]

    @extend_schema(request=PasswordResetConfirmSerializer, responses={204: None}, auth=[])
    @sensitive_variables()
    def post(self, request: Request) -> Response:
        payload = PasswordResetConfirmSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        user = payload.validated_data["user"]
        reset_password(
            user, payload.validated_data["token"], payload.validated_data["new_password"]
        )
        log_auth_event(
            AuthEvent.PASSWORD_RESET_CONFIRMED,
            AuditContext(user_id=user.pk, ip=client_ip(request)),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class LogoutView(APIView):
    """`POST /auth/logout/`: end the web session or revoke the device session of the token.

    Idempotent: with no active session there is nothing to end and it still answers 204. The
    bearer variant accepts an expired or already revoked token, so the app can always log out.
    A web session is CSRF-protected like any authenticated request.
    """

    authentication_classes = [ApiSessionAuthentication, DeviceBearerAuthentication]
    permission_classes = [AllowAny]
    accepts_ended_sessions = True  # read by DeviceBearerAuthentication
    allows_pending_password_change = True

    @extend_schema(request=None, responses={204: None})
    def post(self, request: Request) -> Response:
        user = request.user
        audit = AuditContext(user_id=user.pk, ip=client_ip(request))
        if isinstance(request.auth, DeviceSession):
            session = request.auth
            revoke_session(session, Revocation(RevokeReason.LOGOUT, revoked_by=user))  # type: ignore[arg-type]
            audit = replace(
                audit, organization_id=session.organization_id, device_id=session.device_id
            )
            log_auth_event(AuthEvent.LOGOUT, audit)
        elif user.is_authenticated:
            logout(request._request)
            log_auth_event(AuthEvent.LOGOUT, audit)
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeviceViewSet(
    OrgScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Registered phones of the active organization (W67) and remote revocation of a lost one."""

    queryset = Device.objects.all()
    serializer_class = DeviceSerializer
    filter_backends = [CodeLookupFilter, TableSearchFilter, TableOrderingFilter]
    search_fields = ["label", "serial", "app_version", "searchable_username"]
    search_field_labels = {"searchable_username": "last_user.username (same organization)"}
    ordering_fields = ["label", "serial", "app_version", "last_seen_at", "created_at"]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "head", "options"]
    required_permissions = {
        "list": DEVICE_READ,
        "retrieve": DEVICE_READ,
        "revoke": DEVICE_REVOKE,
    }

    def get_queryset(self) -> QuerySet[Device]:
        if getattr(self, "swagger_fake_view", False):
            return Device.objects.none()
        filters: dict[str, Any] = {}
        if self.action == "list":
            query = DeviceFilterSerializer(data=self.request.query_params)
            query.is_valid(raise_exception=True)
            filters = {
                "is_revoked": query.validated_data.get("is_revoked"),
                "user_id": query.validated_data.get("user"),
            }
        devices = list_devices(self.request.organization, **filters)  # type: ignore[attr-defined]
        return with_searchable_device_user(devices) if self.action == "list" else devices

    @extend_schema(parameters=[DeviceFilterSerializer])
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().list(request, *args, **kwargs)

    @extend_schema(request=RevokeRequestSerializer, responses=DeviceSerializer)
    @action(detail=True, methods=["post"])
    def revoke(self, request: Request, pk: str | None = None) -> Response:
        """Lost phone: the device can no longer log in and every session on it is revoked.

        `allow_final_upload: true` leaves the phone one last upload (default: none).
        """
        payload = RevokeRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        device = revoke_device(
            self.get_object(),
            request.user,  # type: ignore[arg-type]
            payload.validated_data["allow_final_upload"],
        )
        return Response(self.get_serializer(device).data)


class UserViewSet(PersonnelViewSet):
    """Membership-private personnel plus the existing scoped device-session revocation."""

    required_permissions = {
        **PersonnelViewSet.required_permissions,
        "revoke_device_sessions": USER_REVOKE_DEVICE_SESSIONS,
    }

    def get_queryset(self) -> QuerySet[Any]:
        if self.action != "revoke_device_sessions":
            return super().get_queryset()
        if getattr(self, "swagger_fake_view", False):
            return User.objects.none()
        membership = self.request.membership  # type: ignore[attr-defined]
        rows = users_of_organization(membership.organization)
        # Missing historical personnel context requires an explicit org-wide grant.
        if any(
            USER_REVOKE_DEVICE_SESSIONS in codes
            and scope["centers"]["mode"] == scope["quadrants"]["mode"] == "all"
            for codes, scope in effective_scope(membership).grants
        ):
            return rows
        return rows.filter(
            pk__in=scoped_personnel(membership, USER_REVOKE_DEVICE_SESSIONS).values(
                "membership__user_id"
            )
        )

    def get_object(self) -> User | Personnel:
        if self.action == "revoke_device_sessions":
            self.lookup_field = "pk"
        return super().get_object()

    @extend_schema(request=RevokeRequestSerializer, responses=RevokedSessionsSerializer)
    @action(detail=True, methods=["post"], url_path="revoke-device-sessions")
    def revoke_device_sessions(self, request: Request, pk: str | None = None) -> Response:
        """Revoke every phone session the user has in the active organization (W49).

        `allow_final_upload: true` leaves each phone one last upload (default: none).
        """
        payload = RevokeRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        target = cast(User, self.get_object())
        organization = request.organization  # type: ignore[attr-defined]
        revocation = Revocation(
            RevokeReason.ADMIN_REVOKE,
            revoked_by=request.user,  # type: ignore[arg-type]
            allow_final_upload=payload.validated_data["allow_final_upload"],
        )
        count = revoke_scoped_personnel_sessions(
            actor_from_request(request), target.pk, revocation.allow_final_upload
        )
        log_auth_event(
            AuthEvent.SESSIONS_REVOKED,
            AuditContext(organization_id=organization.pk, user_id=target.pk, ip=client_ip(request)),
            {"count": count, "by": request.user.pk, "final_upload": revocation.allow_final_upload},
        )
        return Response(RevokedSessionsSerializer({"revoked_sessions": count}).data)


@method_decorator(never_cache, name="dispatch")
class PasswordChangeView(APIView):
    """`POST /auth/password-change/ {current_password, new_password}` for a web session.

    The one action allowed while `must_change_password` is set. Keeps the current web session
    (new auth hash), ends the user's device sessions.
    """

    authentication_classes = [ApiSessionAuthentication]
    throttle_classes = [PasswordChangeThrottle]
    allows_pending_password_change = True

    @extend_schema(request=PasswordChangeSerializer, responses={204: None})
    @sensitive_variables()
    def post(self, request: Request) -> Response:
        from django.contrib.auth import update_session_auth_hash

        user = cast(User, request.user)
        payload = PasswordChangeSerializer(data=request.data, context={"user": user})
        payload.is_valid(raise_exception=True)
        changed = change_password(
            user,
            payload.validated_data["current_password"],
            payload.validated_data["new_password"],
        )
        update_session_auth_hash(request._request, changed)
        log_auth_event(
            AuthEvent.PASSWORD_RESET_CONFIRMED,
            AuditContext(user_id=user.pk, ip=client_ip(request)),
            {"channel": "change"},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
