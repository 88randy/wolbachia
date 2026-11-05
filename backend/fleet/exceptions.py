from http import HTTPStatus

from core.exceptions import DomainError


class FleetConflictError(DomainError):
    status_code = HTTPStatus.CONFLICT
    default_detail = "The fleet action is blocked by its current state."

    def __init__(self, code: str) -> None:
        self.code = code
        self.blocked_by = [
            {"reason": code, "unblocked_by_role": "supervisor", "link": "/motorcycles/"}
        ]
        super().__init__()
