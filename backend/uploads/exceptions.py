from http import HTTPStatus

from core.exceptions import DomainError


class UploadConflictError(DomainError):
    status_code = HTTPStatus.CONFLICT
    default_detail = "The upload state prevents this operation."

    def __init__(self, code: str) -> None:
        self.code = code
        self.blocked_by = [{"code": code}]
        super().__init__()


class UploadInProgressError(DomainError):
    code = "upload_in_progress"
    status_code = HTTPStatus.TOO_MANY_REQUESTS
    default_detail = "Another evidence operation is in progress; retry."

    def response_headers(self) -> dict[str, str]:
        return {"Retry-After": "1"}


class UploadStorageError(DomainError):
    code = "upload_storage_unavailable"
    status_code = HTTPStatus.SERVICE_UNAVAILABLE
    default_detail = "Private evidence storage is unavailable; retain the local file and retry."
