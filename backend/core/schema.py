import copy
from typing import Any

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
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


HTTP_METHODS = ("get", "put", "post", "patch", "delete", "head", "options", "trace")

ERROR_COMPONENTS: dict[str, dict[str, Any]] = {
    "FieldError": {
        "type": "object",
        "description": "One validation failure of a field: a machine code plus its parameters.",
        "properties": {
            "code": {"type": "string"},
            "params": {"type": "object", "additionalProperties": {}},
        },
        "required": ["code", "params"],
    },
    "BlockedBy": {
        "type": "object",
        "description": "Why a `409` action is blocked and who can unblock it.",
        "properties": {
            "reason": {"type": "string"},
            "point": {
                "type": "string",
                "format": "uuid",
                "description": "Authorized geography point requiring a resolution, when applicable.",
            },
            "params": {
                "type": "object",
                "additionalProperties": {"type": "integer"},
                "description": "Values for the client message of `reason`, e.g. `{count}`.",
            },
            "unblocked_by_role": {"type": "string"},
            "link": {"type": "string"},
        },
        "required": ["reason", "unblocked_by_role", "link"],
    },
    "ErrorEnvelope": {
        "type": "object",
        "description": (
            "Body of every 4xx/5xx response (docs/api-conventions.md). Clients translate `code` "
            "with packages/i18n; `detail` is English, for logs, and is never shown to users."
        ),
        "properties": {
            "code": {"type": "string"},
            "detail": {"type": "string"},
            "fields": {
                "type": "object",
                "description": "Only on `400` validation errors: field name to its errors.",
                "additionalProperties": {
                    "type": "array",
                    "items": {"$ref": "#/components/schemas/FieldError"},
                },
            },
            "blocked_by": {
                "type": "array",
                "description": "Only on `409` blocked actions.",
                "items": {"$ref": "#/components/schemas/BlockedBy"},
            },
        },
        "required": ["code", "detail"],
    },
}

DEFAULT_ERROR_RESPONSE: dict[str, Any] = {
    "description": "Error: any 4xx or 5xx status, with the error envelope as body.",
    "content": {
        "application/json": {"schema": {"$ref": "#/components/schemas/ErrorEnvelope"}},
    },
}


def add_error_envelope(result: dict[str, Any], **kwargs: object) -> dict[str, Any]:
    """Postprocessing hook: documents `ErrorEnvelope` and a `default` error response everywhere.

    OpenAPI has no "every 4xx/5xx" key, so `default` carries it; generated clients type it as
    the error branch of every call. Operations that declare their own `default` keep it.
    drf-spectacular passes `generator`, `request` and `public` by keyword; they are unused.
    """
    schemas = result.setdefault("components", {}).setdefault("schemas", {})
    clashes = sorted(set(schemas) & set(ERROR_COMPONENTS))
    if clashes:
        raise ImproperlyConfigured(f"OpenAPI components already defined: {', '.join(clashes)}.")
    schemas.update(copy.deepcopy(ERROR_COMPONENTS))
    for path_item in result.get("paths", {}).values():
        for method in HTTP_METHODS:
            operation = path_item.get(method)
            if operation is not None:
                operation.setdefault("responses", {}).setdefault(
                    "default", copy.deepcopy(DEFAULT_ERROR_RESPONSE)
                )
    return result
