"""Time helpers shared by the apps: the server clock, API timestamp format, local dates."""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from django.utils import timezone


def server_now() -> datetime:
    """Current server time, timezone-aware UTC. Sent as `server_time` so clients detect clock skew."""
    return timezone.now()


def format_instant(value: datetime) -> str:
    """ISO 8601 UTC with a `Z` suffix, as every timestamp of the API."""
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def local_today(timezone_name: str, now: datetime) -> date:
    """The calendar date at `now` in an IANA timezone (an organization's `timezone`)."""
    return now.astimezone(ZoneInfo(timezone_name)).date()
