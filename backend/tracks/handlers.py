"""Registers `track.segment` in the sync handler registry (from `AppConfig.ready`)."""

from datetime import datetime, timedelta
from typing import Any

from field_sync.codes import INVALID_PAYLOAD
from field_sync.exceptions import EventRejected
from field_sync.registry import EventContext, EventHandler, register
from shifts.codes import SHIFT_NOT_OPEN
from shifts.models import Shift
from tracks.codes import TRACK_SEGMENT_EVENT_TYPE
from tracks.models import TrackSegment
from tracks.payloads import TrackSegmentPayloadSerializer


def _in_window(shift: Shift, at: datetime) -> bool:
    closed = shift.closed_at_device
    return shift.opened_at_device <= at and (closed is None or at <= closed)


def apply_track_segment(ctx: EventContext, data: dict[str, Any]) -> None:
    """Store the positions of the segment that fall inside the sender's shift window.

    Own shift check (`checks_shift=False`): a track is an observation, not an operational effect,
    so a motorcycle safety hold does not retain it, and positions after the close are trimmed
    instead of reviewed. A segment with nothing left inside the window is accepted with no row.
    """
    shift_id = ctx.envelope.shift_id
    if shift_id is None:
        raise EventRejected(INVALID_PAYLOAD, {"fields": {"shift_id": ["required"]}})
    shift = Shift.objects.for_org(ctx.organization).filter(pk=shift_id, courier=ctx.user).first()
    if shift is None:
        raise EventRejected(SHIFT_NOT_OPEN, {"shift_id": str(shift_id)})
    started_at: datetime = data["started_at"]
    positions = data["positions"]
    kept = [
        position
        for position in positions
        if _in_window(shift, started_at + timedelta(seconds=position[0]))
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


def register_track_handlers() -> None:
    register(
        EventHandler(
            TRACK_SEGMENT_EVENT_TYPE,
            1,
            TrackSegmentPayloadSerializer,
            apply_track_segment,
            codes=(SHIFT_NOT_OPEN,),
            checks_shift=False,
        )
    )
