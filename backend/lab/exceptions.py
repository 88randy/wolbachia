"""Safe lab errors retain no foreign identifiers or unverifiable success claims."""

from http import HTTPStatus

from core.exceptions import DomainError


class AnnotationExportNotReadyError(DomainError):
    code = "annotation_export_not_ready"
    status_code = HTTPStatus.CONFLICT


class AnnotationExportExpiredError(DomainError):
    code = "annotation_export_expired"
    status_code = HTTPStatus.CONFLICT


class AnnotationExportInProgressError(DomainError):
    code = "annotation_export_in_progress"
    status_code = HTTPStatus.CONFLICT


class LabConflictError(DomainError):
    status_code = HTTPStatus.CONFLICT

    def __init__(self, code: str, revision: int | None = None) -> None:
        self.code = code
        super().__init__()
        self.blocked_by = [
            {
                "reason": code,
                "unblocked_by_role": "entomologist",
                "link": "",
                **({"current_revision": revision} if revision is not None else {}),
            }
        ]


class LabInProgressError(DomainError):
    code = "lab_in_progress"
    status_code = HTTPStatus.TOO_MANY_REQUESTS

    def response_headers(self) -> dict[str, str]:
        return {"Retry-After": "1"}
