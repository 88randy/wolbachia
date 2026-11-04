from http import HTTPStatus

from core.exceptions import DomainError


class VersionNotScheduledError(DomainError):
    code = "version_not_scheduled"
    status_code = HTTPStatus.CONFLICT
    default_detail = "Only a version that has not taken effect yet can be voided."
