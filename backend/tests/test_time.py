from datetime import UTC, date, datetime, timedelta, timezone

from core.time import format_instant, local_today


def test_format_instant_converts_to_utc_with_z_suffix() -> None:
    local = datetime(2026, 11, 3, 18, 0, tzinfo=timezone(timedelta(hours=-6)))

    assert format_instant(local) == "2026-11-04T00:00:00Z"


def test_format_instant_keeps_a_utc_value() -> None:
    assert format_instant(datetime(2026, 11, 4, tzinfo=UTC)) == "2026-11-04T00:00:00Z"


def test_local_today_uses_the_organization_timezone_not_utc() -> None:
    now = datetime(2026, 11, 4, 2, 0, tzinfo=UTC)

    assert local_today("America/Mexico_City", now) == date(2026, 11, 3)
    assert local_today("UTC", now) == date(2026, 11, 4)
