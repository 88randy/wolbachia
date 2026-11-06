"""Safe state conflicts and bounded retryable resolution contention."""

from http import HTTPStatus

from core.exceptions import DomainError


class RemovalConflictError(DomainError):
    code = "removal_state_conflict"
    status_code = HTTPStatus.CONFLICT
    default_detail = "The removal is no longer in the expected unresolved state."


class RemovalInProgressError(DomainError):
    code = "removal_in_progress"
    status_code = HTTPStatus.TOO_MANY_REQUESTS
    default_detail = "Another removal operation is in progress; retry."

    def response_headers(self) -> dict[str, str]:
        return {"Retry-After": "1"}
