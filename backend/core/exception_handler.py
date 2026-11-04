"""DRF exception handler producing the error envelope of docs/api-conventions.md.

Body: ``{"code", "detail"}`` plus ``"fields"`` on 400 validation errors only:
``{"<field>": [{"code", "params"}]}``. `detail` is English, for logs; clients translate `code`.
"""

import logging
from http import HTTPStatus
from typing import Any

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import RequestDataTooBig
from django.http import Http404
from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework.views import exception_handler, set_rollback

from core.authentication import SESSION_AUTH_SCHEME
from core.exceptions import (
    VALIDATION_ERROR_CODE,
    VALIDATION_ERROR_DETAIL,
    DomainError,
    PayloadTooLargeError,
)
from core.validation import flatten_error_details

logger = logging.getLogger(__name__)

SERVER_ERROR_CODE = "server_error"
SERVER_ERROR_DETAIL = "Internal server error."


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
            "fields": flatten_error_details(exc.get_full_details()),
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


def _domain_error_headers(exc: DomainError) -> dict[str, str] | None:
    """A 401 carries `WWW-Authenticate` (the error's own scheme, else `Session`); an error may
    add headers of its own (`Retry-After`)."""
    headers = exc.response_headers()
    if exc.status_code == HTTPStatus.UNAUTHORIZED:
        headers["WWW-Authenticate"] = exc.challenge or SESSION_AUTH_SCHEME
    return headers or None


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response:
    if isinstance(exc, RequestDataTooBig):  # Django's own body limit: same answer as ours
        exc = PayloadTooLargeError()
    if isinstance(exc, DomainError):
        set_rollback()
        body: dict[str, Any] = {"code": exc.code, "detail": exc.detail}
        if exc.fields:
            body["fields"] = exc.fields
        return Response(body, status=exc.status_code, headers=_domain_error_headers(exc))

    exc = _normalize(exc)
    response = exception_handler(exc, context)
    if response is not None and isinstance(exc, exceptions.APIException):
        response.data = _api_exception_body(exc)
        challenge = getattr(exc, "challenge", None)
        if challenge:
            response["WWW-Authenticate"] = challenge
        return response

    set_rollback()
    _log_unhandled(exc, context)
    return Response(
        {"code": SERVER_ERROR_CODE, "detail": SERVER_ERROR_DETAIL},
        status=HTTPStatus.INTERNAL_SERVER_ERROR,
    )
