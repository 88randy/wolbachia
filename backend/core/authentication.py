from typing import Any

from rest_framework.authentication import SessionAuthentication
from rest_framework.request import Request

SESSION_AUTH_SCHEME = "Session"


class ApiSessionAuthentication(SessionAuthentication):
    """Session auth whose missing credentials answer `401` instead of DRF's default `403`.

    DRF answers 403 when the first authenticator sends no `WWW-Authenticate` challenge; the API
    contract uses 401 `not_authenticated` (docs/api-conventions.md).
    """

    def authenticate_header(self, request: Request) -> str:
        return SESSION_AUTH_SCHEME

    def authenticate(self, request: Request) -> tuple[Any, None] | None:
        from accounts.password_change import enforce_password_change

        result = super().authenticate(request)
        if result is not None:
            enforce_password_change(request, result[0])
        return result
