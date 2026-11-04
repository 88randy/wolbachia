"""Clock skew: when the phone's clock cannot be trusted, its events are reviewed, never rejected.

Skew is measured with the batch's `sent_at` (the phone's clock at send time) against the server
clock at receipt, so an event recorded hours ago offline is not flagged just for being old
(decision 62). Over the threshold every event of the batch goes to review; so does an event
whose `device_time` is further in the future than the threshold allows.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

from field_sync.codes import CLOCK_SKEW
from field_sync.envelope import BatchContext
from field_sync.exceptions import EventNeedsReview
from rules.selectors import get_values_in_force

logger = logging.getLogger(__name__)

# Organizations already warned about in this process: the warning is once, not once per sync.
_warned_organizations: set[object] = set()

CLOCK_SKEW_PARAMETER = "clock_skew_review_seconds"


@dataclass(frozen=True)
class ClockPolicy:
    """Skew of one batch and the threshold in force. `threshold_seconds` is None when the
    parameter has no value ("not configured"): then nothing is flagged but the skew is stored."""

    sent_at: datetime
    skew_seconds: int
    threshold_seconds: int | None

    @property
    def batch_is_skewed(self) -> bool:
        threshold = self.threshold_seconds
        return threshold is not None and abs(self.skew_seconds) > threshold

    def review_signal(self, device_time: datetime) -> EventNeedsReview | None:
        """`clock_skew` when the batch is skewed or `device_time` is too far ahead of `sent_at`."""
        threshold = self.threshold_seconds
        if threshold is None:
            return None
        is_ahead = device_time > self.sent_at + timedelta(seconds=threshold)
        if not (self.batch_is_skewed or is_ahead):
            return None
        return EventNeedsReview(
            CLOCK_SKEW,
            {"skew_seconds": self.skew_seconds, "threshold_seconds": threshold},
        )


def build_clock_policy(batch: BatchContext) -> ClockPolicy:
    """The skew of the batch and the threshold in force when the server received it (reads)."""
    skew_seconds = round((batch.sent_at - batch.received_at).total_seconds())
    threshold = get_values_in_force(batch.organization, batch.received_at).get(CLOCK_SKEW_PARAMETER)
    if threshold is None and batch.organization.pk not in _warned_organizations:
        _warned_organizations.add(batch.organization.pk)
        logger.warning(
            "Clock skew threshold not configured: organization=%s device=%s skew_seconds=%s",
            batch.organization.pk,
            batch.device.pk,
            skew_seconds,
        )
    return ClockPolicy(
        sent_at=batch.sent_at,
        skew_seconds=skew_seconds,
        threshold_seconds=None if threshold is None else int(threshold),
    )
