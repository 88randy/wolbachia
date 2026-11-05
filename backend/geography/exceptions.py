from http import HTTPStatus

from core.exceptions import DomainError


class StaleGeographyRevisionError(DomainError):
    code = "stale_revision"
    status_code = HTTPStatus.CONFLICT
    default_detail = "Reload the current geography revision."
    blocked_by = [{"reason": "stale_revision", "unblocked_by_role": "coordinator", "link": ""}]


class UnresolvedPointsError(DomainError):
    code = "unresolved_points"
    status_code = HTTPStatus.CONFLICT
    default_detail = "Resolve every point excluded by the proposed geometry."

    def __init__(self, point_ids: list[str]) -> None:
        super().__init__()
        self.blocked_by = [
            {
                "reason": "point_outside_geometry",
                "point": identifier,
                "unblocked_by_role": "coordinator",
                "link": "",
            }
            for identifier in point_ids
        ]


class GeographyBusyError(DomainError):
    code = "geography_in_progress"
    status_code = HTTPStatus.TOO_MANY_REQUESTS
    default_detail = "Another geography transaction is in progress. Retry."

    def response_headers(self) -> dict[str, str]:
        return {"Retry-After": "1"}
