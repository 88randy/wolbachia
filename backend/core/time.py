"""Time helpers shared by the apps: the server clock, API timestamp format, local dates."""

from datetime import UTC, date, datetime, time, timedelta
from typing import Protocol
from zoneinfo import ZoneInfo

from django.utils import timezone


class HasTimezone(Protocol):
    """Anything that carries an IANA zone, such as an `Organization`."""

    timezone: str


def server_now() -> datetime:
    """Current server time, timezone-aware UTC. Sent as `server_time` so clients detect clock skew."""
    return timezone.now()


def format_instant(value: datetime) -> str:
    """ISO 8601 UTC with a `Z` suffix, as every timestamp of the API."""
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def local_today(timezone_name: str, now: datetime) -> date:
    """The calendar date at `now` in an IANA timezone (an organization's `timezone`)."""
    return now.astimezone(ZoneInfo(timezone_name)).date()


def localdate(organization: HasTimezone, now: datetime | None = None) -> date:
    """Today for an organization: the server runs in UTC, so `timezone.localdate()` is wrong here."""
    return local_today(organization.timezone, now or server_now())


def local_day_start(timezone_name: str, day: date) -> datetime:
    """The aware instant at which `day` begins in an IANA timezone (local midnight)."""
    return datetime.combine(day, time.min, tzinfo=ZoneInfo(timezone_name))


def epi_week_start(day: date, convention: str) -> date:
    """Start of the organization's epi week; ISO Monday, MMWR Sunday."""
    offset = 0 if convention == "iso" else 1
    return day - timedelta(days=(day.weekday() + offset) % 7)


def epi_week_label(day: date, convention: str) -> str:
    """ISO/MMWR week with at least four days in week one (shared capture/planning rule)."""
    if convention == "iso":
        year, week, _day = day.isocalendar()
        return f"{year:04d}-W{week:02d}"
    year = day.year
    if day < epi_week_start(date(year, 1, 4), convention):
        year -= 1
    elif day >= epi_week_start(date(year + 1, 1, 4), convention):
        year += 1
    week = (day - epi_week_start(date(year, 1, 4), convention)).days // 7 + 1
    return f"{year:04d}-W{week:02d}"
