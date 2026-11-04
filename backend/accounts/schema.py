from typing import Any

from drf_spectacular.extensions import OpenApiAuthenticationExtension
from drf_spectacular.openapi import AutoSchema


class DeviceBearerAuthenticationScheme(OpenApiAuthenticationExtension):
    """Documents `DeviceBearerAuthentication` as the HTTP bearer scheme `bearerAuth`."""

    target_class = "accounts.authentication.DeviceBearerAuthentication"
    name = "bearerAuth"

    def get_security_definition(self, auto_schema: AutoSchema) -> dict[str, Any]:
        return {"type": "http", "scheme": "bearer", "description": "Opaque access token."}
