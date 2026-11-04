"""Authentication endpoints. Public ones declare their own throttles and no authenticators."""

from dataclasses import dataclass, replace
from typing import Any

from django.contrib.auth import login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.audit import AuditContext, AuthEvent, fingerprint, log_auth_event
from accounts.authentication import EndedSessionBearerAuthentication
from accounts.models import DeviceSession, RevokeReason, User
from accounts.serializers import (
    LoginSerializer,
    MobileLoginResponseSerializer,
    RefreshResponseSerializer,
    RefreshSerializer,
    WebLoginResponseSerializer,
)
from accounts.services import (
    DeviceInfo,
    Revocation,
    authenticate_user,
    revoke_session,
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
