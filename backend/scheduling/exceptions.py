"""Safe state conflicts and retryable scheduling contention."""

from http import HTTPStatus
from typing import Any

from core.exceptions import DomainError


class SchedulingConflictError(DomainError):
    status_code = HTTPStatus.CONFLICT
    default_detail = "The scheduling state prevents this operation."

    def __init__(self, code: str, blocked_by: list[dict[str, Any]] | None = None) -> None:
        self.code = code
        self.blocked_by = blocked_by or [{"code": code}]
        super().__init__()


class SchedulingBusyError(DomainError):
    code = "scheduling_in_progress"
    status_code = HTTPStatus.TOO_MANY_REQUESTS
    default_detail = "Another scheduling operation is in progress; retry."

    def response_headers(self) -> dict[str, str]:
        return {"Retry-After": "1"}
