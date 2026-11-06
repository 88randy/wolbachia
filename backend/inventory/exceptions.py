from http import HTTPStatus

from core.exceptions import DomainError


class InventoryConflictError(DomainError):
    code = "inventory_state_conflict"
    status_code = HTTPStatus.CONFLICT
    default_detail = "The inventory operation conflicts with retained facts."

    def __init__(self, reason: str, revision: int | None = None) -> None:
        super().__init__()
        self.blocked_by = [
            {
                "reason": reason,
                "unblocked_by_role": "warehouse",
                "link": "",
                **({"current_revision": revision} if revision is not None else {}),
            }
        ]


class InventoryInProgressError(DomainError):
    code = "inventory_in_progress"
    status_code = HTTPStatus.TOO_MANY_REQUESTS
    default_detail = "An inventory operation is in progress; retry the whole request."

    def response_headers(self) -> dict[str, str]:
        return {"Retry-After": "1"}
