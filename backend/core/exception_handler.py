"""DRF exception handler producing the error envelope of docs/api-conventions.md.

Body: ``{"code", "detail"}`` plus ``"fields"`` on 400 validation errors only:
``{"<field>": [{"code", "params"}]}``. `detail` is English, for logs; clients translate `code`.
"""

import logging
from http import HTTPStatus
from typing import Any

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework.views import exception_handler, set_rollback

from core.exceptions import VALIDATION_ERROR_CODE, VALIDATION_ERROR_DETAIL, DomainError

logger = logging.getLogger(__name__)

SERVER_ERROR_CODE = "server_error"
SERVER_ERROR_DETAIL = "Internal server error."
NON_FIELD_KEY = "non_field_errors"


def _flatten_codes(codes: object, prefix: str = "") -> dict[str, list[dict[str, Any]]]:
    """Turn `ValidationError.get_codes()` into `{field: [{code, params}]}` (nested keys dotted)."""
    if isinstance(codes, dict):
        flat: dict[str, list[dict[str, Any]]] = {}
        for key, value in codes.items():
            flat.update(_flatten_codes(value, f"{prefix}.{key}" if prefix else str(key)))
        return flat
    if isinstance(codes, list):
        if all(isinstance(item, str) for item in codes):
            return {prefix or NON_FIELD_KEY: [{"code": code, "params": {}} for code in codes]}
        flat = {}
        for index, item in enumerate(codes):
            flat.update(_flatten_codes(item, f"{prefix}.{index}" if prefix else str(index)))
        return flat
    return {prefix or NON_FIELD_KEY: [{"code": str(codes), "params": {}}]}


def _normalize(exc: Exception) -> Exception:
    if isinstance(exc, Http404):
        return exceptions.NotFound()
    if isinstance(exc, DjangoPermissionDenied):
        return exceptions.PermissionDenied()
    return exc


def _api_exception_body(exc: exceptions.APIException) -> dict[str, Any]:
    if isinstance(exc, exceptions.ValidationError):
        return {
            "code": VALIDATION_ERROR_CODE,
            "detail": VALIDATION_ERROR_DETAIL,
            "fields": _flatten_codes(exc.get_codes()),
        }
    return {"code": str(exc.get_codes()), "detail": str(exc.detail)}


def _log_unhandled(exc: Exception, context: dict[str, Any]) -> None:
    request = context.get("request")
    user = getattr(request, "user", None)
    organization = getattr(request, "organization", None)
    logger.error(
        "Unhandled error: organization=%s user=%s path=%s",
        getattr(organization, "pk", None),
        getattr(user, "pk", None),
        getattr(request, "path", None),
        exc_info=exc,
    )


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response:
    if isinstance(exc, DomainError):
        set_rollback()
        body: dict[str, Any] = {"code": exc.code, "detail": exc.detail}
        if exc.fields:
            body["fields"] = exc.fields
        return Response(body, status=exc.status_code)

    exc = _normalize(exc)
    response = exception_handler(exc, context)
    if response is not None and isinstance(exc, exceptions.APIException):
        response.data = _api_exception_body(exc)
        return response

    set_rollback()
    _log_unhandled(exc, context)
    return Response(
        {"code": SERVER_ERROR_CODE, "detail": SERVER_ERROR_DETAIL},
        status=HTTPStatus.INTERNAL_SERVER_ERROR,
    )
