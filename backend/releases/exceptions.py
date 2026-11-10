"""State conflicts expose only already-authorized regulatory blockers."""

from http import HTTPStatus

from core.exceptions import DomainError


class ReleaseConflictError(DomainError):
    code = "release_state_conflict"
    status_code = HTTPStatus.CONFLICT
    default_detail = "The command conflicts with retained release facts."

    def __init__(self, reason: str) -> None:
        super().__init__()
        self.blocked_by = [{"reason": reason, "unblocked_by_role": "admin", "link": ""}]
