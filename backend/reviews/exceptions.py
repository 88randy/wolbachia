"""Bounded review conflicts never alter original capture history."""

from http import HTTPStatus

from core.exceptions import DomainError


class ReviewConflictError(DomainError):
    code = "review_conflict"
    status_code = HTTPStatus.CONFLICT
    default_detail = "The review revision or disposition changed."


class ReviewBlockedError(DomainError):
    code = "review_blocked"
    status_code = HTTPStatus.CONFLICT
    default_detail = "The review cannot apply an effect with the available facts."

    def __init__(self, reasons: tuple[str, ...]) -> None:
        super().__init__()
        self.blocked_by = [
            {"reason": reason, "unblocked_by_role": "admin", "link": ""} for reason in reasons
        ]


class SafetyDispositionRequiredError(ReviewBlockedError):
    code = "safety_disposition_required"
    default_detail = "A severe review requires a valid safety disposition."

    def __init__(self) -> None:
        super().__init__(("safety_disposition_required",))
