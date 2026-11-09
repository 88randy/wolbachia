"""Bounded conflicts preserve the original source and geography epoch."""

from http import HTTPStatus
from typing import Any

from core.exceptions import DomainError


class GeographyDecisionConflictError(DomainError):
    code = "geography_decision_conflict"
    status_code = HTTPStatus.CONFLICT
    default_detail = "Reload the current decision and resolve its blockers."

    def __init__(self, blocked_by: list[dict[str, Any]]) -> None:
        super().__init__()
        self.blocked_by = blocked_by
