"""Retry delays use actual UTC elapsed seconds even across local DST transitions."""

from datetime import UTC, datetime

import pytest

from accounts.models import Device, User
from field_sync.envelope import BatchContext
from field_sync.services import rejection_quota_window
from organizations.models import Organization


@pytest.mark.parametrize(
    ("zone", "received_at", "local_date", "seconds"),
    [
        ("America/New_York", datetime(2026, 3, 8, 6, 30, tzinfo=UTC), "2026-03-08", 77400),
        ("America/New_York", datetime(2026, 11, 1, 4, 30, tzinfo=UTC), "2026-11-01", 88200),
    ],
)
def test_retry_delay_measures_elapsed_seconds_across_dst(zone, received_at, local_date, seconds):
    batch = BatchContext(
        organization=Organization(timezone=zone),
        user=User(),
        device=Device(),
        sent_at=received_at,
        received_at=received_at,
    )

    day, retry_after = rejection_quota_window(batch)

    assert day.isoformat() == local_date
    assert retry_after == seconds
