"""The `shift_id` of an event is a real reference (issue #68, docs/sync.md "Shifts").

Every event that names a shift (except `shift.open`, `shift.close` and `record.void`, which opt
out with `EventHandler.checks_shift=False`) is checked here by the sync pipeline:

- a shift that does not exist, belongs to another organization or to another courier is
  `rejected` with `shift_not_open` (one answer for all three, so nothing leaks);
- a shift that is closed is fine for an event the phone captured before it closed (`device_time`
  up to `closed_at_device`: offline work reaches the server after the close); a later event is
  stored `in_review` with `captured_after_shift_close`;
- an open shift accepts it.
"""

from accounts.models import User
from field_sync.envelope import EventEnvelope
from field_sync.exceptions import EventNeedsReview, EventRejected
from organizations.models import Organization
from shifts.codes import CAPTURED_AFTER_SHIFT_CLOSE, SHIFT_NOT_OPEN
from shifts.models import Shift, ShiftStatus


def check_event_shift(
    organization: Organization, user: User, envelope: EventEnvelope
) -> EventNeedsReview | None:
    """Reads the shift the event names. Raises `EventRejected`; returns the review signal for an
    event captured after the shift closed; `None` when the event has no shift or the shift fits."""
    shift_id = envelope.shift_id
    if shift_id is None:
        return None
    shift = Shift.objects.for_org(organization).filter(pk=shift_id, courier=user).first()
    if shift is None:
        raise EventRejected(SHIFT_NOT_OPEN, {"shift_id": str(shift_id)})
    if shift.status == ShiftStatus.OPEN:
        return None
    closed_at = shift.closed_at_device
    if closed_at is not None and envelope.device_time <= closed_at:
        return None
    return EventNeedsReview(CAPTURED_AFTER_SHIFT_CLOSE, {"shift_id": str(shift_id)})
