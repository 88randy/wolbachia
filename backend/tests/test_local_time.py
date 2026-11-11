"""Organization-local "today" at the Mérida evening boundary, when the UTC date is already tomorrow."""

from datetime import UTC, date, datetime
from types import SimpleNamespace
from typing import Any, cast

from core.time import local_day_start, localdate
from privacy.exports import _bounds, _span

MERIDA = SimpleNamespace(timezone="America/Merida")
# 20:30 on 10 Nov in Mérida (UTC-6); the UTC date is 11 Nov.
EVENING = datetime(2026, 11, 11, 2, 30, tzinfo=UTC)


def test_localdate_is_the_organization_day_not_the_utc_day() -> None:
    assert EVENING.date() == date(2026, 11, 11)
    assert localdate(MERIDA, EVENING) == date(2026, 11, 10)
    assert localdate(MERIDA, datetime(2026, 11, 11, 6, 0, tzinfo=UTC)) == date(2026, 11, 11)


def test_local_day_start_is_local_midnight() -> None:
    start = local_day_start("America/Merida", date(2026, 11, 10))
    assert start.astimezone(UTC) == datetime(2026, 11, 10, 6, 0, tzinfo=UTC)


def test_export_span_covers_whole_local_days() -> None:
    actor = cast(Any, SimpleNamespace(organization=MERIDA))
    span = _span(_bounds(actor, date(2026, 11, 10), date(2026, 11, 10)), "device_time")
    assert span["device_time__gte"] <= EVENING < span["device_time__lt"]
    assert span["device_time__lt"].astimezone(UTC) == datetime(2026, 11, 11, 6, 0, tzinfo=UTC)
