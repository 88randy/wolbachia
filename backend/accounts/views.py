"""Authentication endpoints. Public ones declare their own throttles and no authenticators."""

from dataclasses import dataclass, replace
from typing import Any

from django.contrib.auth import login, logout
from django.db.models import QuerySet
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.audit import AuditContext, AuthEvent, fingerprint, log_auth_event
from accounts.authentication import EndedSessionBearerAuthentication
from accounts.constants import DEVICE_READ, DEVICE_REVOKE, USER_REVOKE_DEVICE_SESSIONS
from accounts.models import Device, DeviceSession, RevokeReason, User
from accounts.selectors import list_devices, users_of_organization
from accounts.serializers import (
    DeviceFilterSerializer,
    DeviceSerializer,
    LoginSerializer,
    MobileLoginResponseSerializer,
    RefreshResponseSerializer,
    RefreshSerializer,
    RevokedSessionsSerializer,
    WebLoginResponseSerializer,
)
from accounts.services import (
    DeviceInfo,
    Revocation,
    authenticate_user,
    revoke_device,
    revoke_session,
    revoke_user_sessions,
    rotate_refresh_token,
    start_device_session,
)
from accounts.throttling import (
    LoginIpThrottle,
    LoginUserIpThrottle,
    RefreshThrottle,
    client_ip,
)
from core.authentication import ApiSessionAuthentication
from core.constants import ORGANIZATION_HEADER
from core.time import server_now
from core.views import OrgScopedViewSetMixin
from organizations.selectors import get_me_context, resolve_active_membership

LoginResponse = PolymorphicProxySerializer(
    component_name="LoginResponse",
    serializers=[MobileLoginResponseSerializer, WebLoginResponseSerializer],
    resource_type_field_name=None,
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


class LoginView(APIView):
    """`POST /auth/login/`. With `device_id`: mobile tokens. Without: a web session (CSRF)."""

    authentication_classes: list[Any] = []
    permission_classes = [AllowAny]
    throttle_classes = [LoginIpThrottle, LoginUserIpThrottle]

    @extend_schema(request=LoginSerializer, responses={200: LoginResponse}, auth=[])
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
            organization_slug=request.headers.get(ORGANIZATION_HEADER),
            audit=AuditContext(
                user_id=user.pk,
                device_id=data.get("device_id"),
                ip=client_ip(request),
                username_fingerprint=fingerprint(data["username"]),
            ),
        )
        if is_mobile:
            return self._mobile_login(login_state, data)
        return self._web_login(request, login_state)

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
        log_auth_event(
            AuthEvent.LOGIN_SUCCEEDED,
            replace(state.audit, organization_id=organization.pk if organization else None),
            {"channel": "web"},
        )
        return Response(WebLoginResponseSerializer({"me": me, "server_time": server_now()}).data)


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


class LogoutView(APIView):
    """`POST /auth/logout/`: end the web session or revoke the device session of the token.

    Idempotent: with no active session there is nothing to end and it still answers 204. The
    bearer variant accepts an expired or already revoked token, so the app can always log out.
    A web session is CSRF-protected like any authenticated request.
    """

    authentication_classes = [ApiSessionAuthentication, EndedSessionBearerAuthentication]
    permission_classes = [AllowAny]

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
    http_method_names = ["get", "post", "head", "options"]
    required_permissions = {
        "list": DEVICE_READ,
        "retrieve": DEVICE_READ,
        "revoke": DEVICE_REVOKE,
    }

    def get_queryset(self) -> QuerySet[Device]:
        filters: dict[str, Any] = {}
        if self.action == "list":
            query = DeviceFilterSerializer(data=self.request.query_params)
            query.is_valid(raise_exception=True)
            filters = {
                "is_revoked": query.validated_data.get("is_revoked"),
                "user_id": query.validated_data.get("user"),
            }
        return list_devices(self.request.organization, **filters)  # type: ignore[attr-defined]

    @extend_schema(parameters=[DeviceFilterSerializer])
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().list(request, *args, **kwargs)

    @extend_schema(request=None, responses=DeviceSerializer)
    @action(detail=True, methods=["post"])
    def revoke(self, request: Request, pk: str | None = None) -> Response:
        """Lost phone: the device can no longer log in and every session on it is revoked."""
        device = revoke_device(self.get_object(), request.user)  # type: ignore[arg-type]
        return Response(self.get_serializer(device).data)


class UserViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    """Only the device-session revocation lives here for now; the user CRUD arrives with #37."""

    queryset = User.objects.all()
    serializer_class = RevokedSessionsSerializer
    http_method_names = ["post", "options"]
    required_permissions = {"revoke_device_sessions": USER_REVOKE_DEVICE_SESSIONS}

    def get_queryset(self) -> QuerySet[User]:
        # Users are not org-scoped rows: the scope is "has a membership in this organization",
        # so a user of another organization is a 404.
        return users_of_organization(self.request.organization)  # type: ignore[attr-defined]

    @extend_schema(request=None, responses=RevokedSessionsSerializer)
    @action(detail=True, methods=["post"], url_path="revoke-device-sessions")
    def revoke_device_sessions(self, request: Request, pk: str | None = None) -> Response:
        """Revoke every phone session the user has in the active organization (W49)."""
        target = self.get_object()
        organization = request.organization  # type: ignore[attr-defined]
        count = revoke_user_sessions(
            target,
            Revocation(RevokeReason.ADMIN_REVOKE, revoked_by=request.user),  # type: ignore[arg-type]
            organization=organization,
        )
        log_auth_event(
            AuthEvent.SESSIONS_REVOKED,
            AuditContext(organization_id=organization.pk, user_id=target.pk, ip=client_ip(request)),
            {"count": count, "by": request.user.pk},
        )
        return Response(RevokedSessionsSerializer({"revoked_sessions": count}).data)
