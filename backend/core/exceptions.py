"""Named domain exceptions and how they map to API responses (docs/api-conventions.md)."""

from http import HTTPStatus


class DomainError(Exception):
    """Base for errors the API reports with a machine `code` (never user-facing text)."""

    code = "domain_error"
    status_code = HTTPStatus.BAD_REQUEST
    default_detail = "The request could not be processed."
    # `WWW-Authenticate` scheme of a 401 answer; None means the API's default (`Session`).
    challenge: str | None = None

    def __init__(self, detail: str | None = None) -> None:
        self.detail = detail or self.default_detail
        super().__init__(self.detail)


class AlreadyVoidedError(DomainError):
    code = "already_voided"
    status_code = HTTPStatus.CONFLICT
    default_detail = "The record is already voided."


class PhysicalDeleteForbiddenError(Exception):
    """Raised when code tries to delete a business record. It is a bug, never an API response."""
