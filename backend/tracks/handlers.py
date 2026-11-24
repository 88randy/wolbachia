"""Registers `track.segment` in the sync handler registry (from `AppConfig.ready`)."""

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from field_sync.clock import CLOCK_SKEW_PARAMETER
from field_sync.codes import CAUSAL_PARENT_PENDING, INVALID_PAYLOAD
from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.models import EventStatus, FieldEvent
from field_sync.registry import EventContext, EventHandler, register
from reviews.models import ReviewParentClaim
from shifts.codes import SHIFT_NOT_OPEN
from shifts.models import Shift
from tracks.codes import TRACK_SEGMENT_EVENT_TYPE, TRACK_SEGMENT_NOT_VOIDABLE
from tracks.models import TrackSegment
from tracks.payloads import TrackSegmentPayloadSerializer

# Used only when the organization has no clock skew threshold configured (the seed default).
DEFAULT_FUTURE_TOLERANCE_SECONDS = 300


def _in_window(shift: Shift, at: datetime, latest: datetime) -> bool:
    closed = shift.closed_at_device
    return shift.opened_at_device <= at <= latest and (closed is None or at <= closed)


def _reviewed_opening(ctx: EventContext, shift_id: UUID) -> bool:
    """The sender's own `shift.open` of this id is stored `in_review` (severe check, odometer,
    clock skew...): no Shift row exists yet, but the shift is real and its track must survive."""
    return ReviewParentClaim.objects.filter(
        kind="shift",
        identity=shift_id,
        source_event__organization=ctx.organization,
        source_event__created_by=ctx.user,
        source_event__status=EventStatus.IN_REVIEW,
    ).exists()


def apply_track_segment(ctx: EventContext, data: dict[str, Any]) -> None:
    """Store the positions of the segment that fall inside the sender's shift window.

    Own shift check (`checks_shift=False`): a track is an observation, not an operational effect,
    so a motorcycle safety hold does not retain it, and positions after the close are trimmed
    instead of reviewed. Positions further ahead than the server receipt plus the clock skew
    tolerance are trimmed too, so a forward clock cannot pin the last position. A segment with
    nothing left inside the window is accepted with no row. A segment of a shift whose opening
    waits in review is retained `in_review` (`causal_parent_pending`), never rejected.
    """
    shift_id = ctx.envelope.shift_id
    if shift_id is None:
        raise EventRejected(INVALID_PAYLOAD, {"fields": {"shift_id": ["required"]}})
    shift = Shift.objects.for_org(ctx.organization).filter(pk=shift_id, courier=ctx.user).first()
    if shift is None:
        if _reviewed_opening(ctx, shift_id):
            raise EventNeedsReview(CAUSAL_PARENT_PENDING, {"shift_id": str(shift_id)})
        raise EventRejected(SHIFT_NOT_OPEN, {"shift_id": str(shift_id)})
    tolerance = ctx.rules_at(ctx.server_received_at).get(CLOCK_SKEW_PARAMETER)
    latest = ctx.server_received_at + timedelta(
        seconds=int(tolerance) if tolerance is not None else DEFAULT_FUTURE_TOLERANCE_SECONDS
    )
    started_at: datetime = data["started_at"]
    positions = data["positions"]
    kept = [
        position
        for position in positions
        if _in_window(shift, started_at + timedelta(seconds=position[0]), latest)
    ]
    if not kept:
        return
    base = kept[0][0]
    TrackSegment.objects.create(
        organization=ctx.organization,
        created_by=ctx.user,
        field_event_id=ctx.envelope.id,
        shift=shift,
        courier=shift.courier,
        started_at_device=started_at + timedelta(seconds=base),
        ended_at_device=started_at + timedelta(seconds=kept[-1][0]),
        position_count=len(kept),
        positions=[[position[0] - base, *position[1:]] for position in kept],
        trimmed_count=len(positions) - len(kept),
    )


def refuse_void(ctx: EventContext, voided_event: FieldEvent) -> None:
    """A track is an observation of where the courier was: its author cannot remove it."""
    raise EventRejected(TRACK_SEGMENT_NOT_VOIDABLE)


def register_track_handlers() -> None:
    register(
        EventHandler(
            TRACK_SEGMENT_EVENT_TYPE,
            1,
            TrackSegmentPayloadSerializer,
            apply_track_segment,
            on_void=refuse_void,
            codes=(SHIFT_NOT_OPEN, CAUSAL_PARENT_PENDING, TRACK_SEGMENT_NOT_VOIDABLE),
            checks_shift=False,
        )
    )
