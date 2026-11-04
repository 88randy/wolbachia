from typing import Any

from django.conf import settings
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from drf_spectacular.openapi import AutoSchema
from drf_spectacular.utils import OpenApiParameter

from core.constants import ORGANIZATION_HEADER


class ApiSessionAuthenticationScheme(OpenApiAuthenticationExtension):
    """Documents `ApiSessionAuthentication` (a SessionAuthentication subclass) as a cookie."""

    target_class = "core.authentication.ApiSessionAuthentication"
    name = "cookieAuth"

    def get_security_definition(self, auto_schema: AutoSchema) -> dict[str, Any]:
        return {"type": "apiKey", "in": "cookie", "name": settings.SESSION_COOKIE_NAME}


ORGANIZATION_HEADER_PARAMETER = OpenApiParameter(
    name=ORGANIZATION_HEADER,
    type=str,
    location=OpenApiParameter.HEADER,
    required=False,
    description=(
        "Slug of the active organization. Required only for users with more than one active "
        "membership; when sent it is always validated."
    ),
)


class ApiAutoSchema(AutoSchema):
    """Adds the `X-Organization` header to every view that resolves an active organization."""

    def get_override_parameters(self) -> list[Any]:
        parameters = super().get_override_parameters()
        if getattr(self.view, "uses_organization_header", False):
            return [*parameters, ORGANIZATION_HEADER_PARAMETER]
        return parameters
