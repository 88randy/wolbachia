"""Authentication endpoints. Public ones declare their own throttles and no authenticators."""

from dataclasses import dataclass, replace
from typing import Any

from django.contrib.auth import login
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
from accounts.models import User
from accounts.serializers import (
    LoginSerializer,
    MobileLoginResponseSerializer,
    WebLoginResponseSerializer,
)
from accounts.services import DeviceInfo, authenticate_user, start_device_session
from accounts.throttling import LoginIpThrottle, LoginUserIpThrottle, client_ip
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
