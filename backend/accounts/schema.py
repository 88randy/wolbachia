from typing import Any

from drf_spectacular.extensions import OpenApiAuthenticationExtension
from drf_spectacular.openapi import AutoSchema


class DeviceBearerAuthenticationScheme(OpenApiAuthenticationExtension):
    """Documents `DeviceBearerAuthentication` as an HTTP bearer scheme (`bearerAuth`)."""

    target_class = "accounts.authentication.DeviceBearerAuthentication"
    name = "bearerAuth"

    def get_security_definition(self, auto_schema: AutoSchema) -> dict[str, Any]:
        return {"type": "http", "scheme": "bearer", "description": "Opaque access token."}


class EndedSessionBearerAuthenticationScheme(DeviceBearerAuthenticationScheme):
    """Same scheme for the logout variant, which also accepts expired or revoked tokens."""

    target_class = "accounts.authentication.EndedSessionBearerAuthentication"
