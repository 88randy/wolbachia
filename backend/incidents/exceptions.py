"""Safe incident conflicts and retryable domain contention."""

from http import HTTPStatus

from core.exceptions import DomainError


class IncidentConflictError(DomainError):
    code = "incident_conflict"
    status_code = HTTPStatus.CONFLICT
    default_detail = "The incident cannot make this transition."

    def __init__(self, kind: str, revision: int | None = None) -> None:
        super().__init__()
        self.blocked_by = [
            {
                "reason": kind,
                "unblocked_by_role": "admin"
                if kind
                in {"incident_configuration", "terminal_owner_dependency", "protected_other"}
                else "supervisor",
                "link": "",
                **({"current_revision": revision} if revision is not None else {}),
            }
        ]


class IncidentConfigurationUnavailableError(IncidentConflictError):
    def __init__(self) -> None:
        super().__init__("incident_configuration")


class IncidentInProgressError(DomainError):
    code = "incident_in_progress"
    status_code = HTTPStatus.TOO_MANY_REQUESTS
    default_detail = "An incident operation is in progress; retry the whole request."

    def response_headers(self) -> dict[str, str]:
        return {"Retry-After": "1"}
