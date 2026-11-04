"""Rate limits of the public authentication endpoints.

Every key uses `get_ident`, which honors `NUM_PROXIES` (DRF setting `DRF_NUM_PROXIES`): with 0
the `X-Forwarded-For` header is ignored, so rotating it cannot evade a limit.
"""

from collections.abc import Mapping

from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.throttling import BaseThrottle, SimpleRateThrottle
from rest_framework.views import APIView

from accounts.audit import fingerprint


def client_ip(request: Request) -> str | None:
    """Client address as DRF throttles see it (respects `NUM_PROXIES`)."""
    return BaseThrottle().get_ident(request) or None


def submitted_username(request: Request) -> str:
    """The `username` of the JSON body, or "" when the body has none or is not parseable."""
    try:
        data = request.data
    except ParseError:
        return ""
    username = data.get("username") if isinstance(data, Mapping) else None
    return username if isinstance(username, str) else ""


class IdentThrottle(SimpleRateThrottle):
    """Limit per client address. Subclasses only set `scope` (rate: `DEFAULT_THROTTLE_RATES`)."""

    def get_cache_key(self, request: Request, view: APIView) -> str | None:
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class LoginIpThrottle(IdentThrottle):
    scope = "login_ip"


class LoginUserIpThrottle(SimpleRateThrottle):
    """Limit per username and address, so one user's attempts never block another user."""

    scope = "login_user_ip"

    def get_cache_key(self, request: Request, view: APIView) -> str | None:
        ident = f"{fingerprint(submitted_username(request))}:{self.get_ident(request)}"
        return self.cache_format % {"scope": self.scope, "ident": ident}


class RefreshThrottle(IdentThrottle):
    scope = "refresh"


class PasswordResetThrottle(IdentThrottle):
    scope = "password_reset"


class PasswordResetConfirmThrottle(IdentThrottle):
    scope = "password_reset_confirm"
