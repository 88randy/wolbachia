"""Named domain exceptions and how they map to API responses (docs/api-conventions.md)."""

from http import HTTPStatus
from typing import Any

VALIDATION_ERROR_CODE = "validation_error"
VALIDATION_ERROR_DETAIL = "Validation failed."


class DomainError(Exception):
    """Base for errors the API reports with a machine `code` (never user-facing text).

    `fields` is set only by errors that report per-field codes (`400 validation_error`).
    """

    code = "domain_error"
    status_code = HTTPStatus.BAD_REQUEST
    default_detail = "The request could not be processed."
    fields: dict[str, list[dict[str, Any]]] | None = None

    def __init__(self, detail: str | None = None) -> None:
        self.detail = detail or self.default_detail
        super().__init__(self.detail)


class AlreadyVoidedError(DomainError):
    code = "already_voided"
    status_code = HTTPStatus.CONFLICT
    default_detail = "The record is already voided."


class FieldValidationError(DomainError):
    """A `400 validation_error` raised from a service, with one coded field error.

    Same body as a serializer failure (`fields` is `{field: [{code, params}]}`), but `params`
    can carry values the client needs for its message, e.g. `{"min": 0, "max": 100}`.
    """

    code = VALIDATION_ERROR_CODE
    default_detail = VALIDATION_ERROR_DETAIL

    def __init__(self, field: str, field_code: str, params: dict[str, Any] | None = None) -> None:
        super().__init__()
        self.fields = {field: [{"code": field_code, "params": params or {}}]}


class PhysicalDeleteForbiddenError(Exception):
    """Raised when code tries to delete a business record. It is a bug, never an API response."""


class ImmutableRecordError(Exception):
    """Raised when code tries to modify an insert-only record. It is a bug, never a response."""
