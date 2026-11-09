"""Safe conflicts never expose another subject's command, score or evidence."""

from http import HTTPStatus

from core.exceptions import DomainError


class PeopleConflictError(DomainError):
    code = "people_state_conflict"
    status_code = HTTPStatus.CONFLICT
    default_detail = "The command conflicts with retained training facts."

    def __init__(self, reason: str) -> None:
        super().__init__()
        self.blocked_by = [{"reason": reason, "unblocked_by_role": "admin", "link": ""}]
