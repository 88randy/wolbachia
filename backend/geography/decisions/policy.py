"""Explicit closed-epoch dispositions and organization-local next-day dates."""

from datetime import date, datetime, timedelta
from typing import Final, Literal
from zoneinfo import ZoneInfo

LateWork = Literal["late_work_after_quadrant_close", "captured_after_quadrant_close"]
PRE_CLOSE_LATE: Final[LateWork] = "late_work_after_quadrant_close"
POST_CLOSE: Final[LateWork] = "captured_after_quadrant_close"


def classify_closed_epoch(
    captured_at: datetime, received_at: datetime, closed_at: datetime | None
) -> LateWork | None:
    if closed_at is None:
        return None
    if captured_at >= closed_at:
        return POST_CLOSE
    return PRE_CLOSE_LATE if received_at >= closed_at else None


def next_organization_day(instant: datetime, timezone_name: str) -> date:
    return instant.astimezone(ZoneInfo(timezone_name)).date() + timedelta(days=1)
