"""Safe command and policy conflicts; never expose another command's body."""

from http import HTTPStatus

from core.exceptions import DomainError


class CommunityConflictError(DomainError):
    code = "community_state_conflict"
    status_code = HTTPStatus.CONFLICT
    default_detail = "The community command conflicts with retained facts."

    def __init__(self, reason: str = "community_state_conflict") -> None:
        super().__init__()
        self.blocked_by = [{"reason": reason, "unblocked_by_role": "supervisor", "link": ""}]
