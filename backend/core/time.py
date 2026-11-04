"""Time helpers shared by the apps: API timestamp format and organization-local dates."""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo


def format_instant(value: datetime) -> str:
    """ISO 8601 UTC with a `Z` suffix, as every timestamp of the API."""
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def local_today(timezone_name: str, now: datetime) -> date:
    """The calendar date at `now` in an IANA timezone (an organization's `timezone`)."""
    return now.astimezone(ZoneInfo(timezone_name)).date()
