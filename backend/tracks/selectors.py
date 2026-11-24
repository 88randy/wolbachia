"""Reads of the courier track. Callers pass shifts already scoped to what the viewer may read."""

from typing import Any

from django.db.models import QuerySet

from field_sync.models import EventStatus, FieldEvent
from reviews.models import ReviewDecision
from shifts.models import Shift
from tracks.codes import TRACK_SEGMENT_EVENT_TYPE
from tracks.models import TrackSegment


def effective_segments() -> QuerySet[TrackSegment]:
    """Segments whose source event is not voided."""
    return TrackSegment.objects.filter(field_event__voided_at__isnull=True)


def last_positions(shifts: QuerySet[Shift]) -> list[dict[str, Any]]:
    """The last stored position of each shift of `shifts` that has one (one query).

    A subquery picks the latest segment id per shift (`DISTINCT ON` over ids only, no JSON in
    the sort), then only those rows are loaded with their positions.
    """
    latest_ids = (
        effective_segments()
        .filter(shift__in=shifts)
        .order_by("shift_id", "-ended_at_device", "-field_event__server_received_at", "-id")
        .distinct("shift_id")
        .values("id")
    )
    latest = TrackSegment.objects.filter(pk__in=latest_ids).select_related(
        "shift__motorcycle", "field_event"
    )
    rows = []
    for segment in latest:
        _, lat, lng, accuracy_m = segment.positions[-1]
        rows.append(
            {
                "shift_id": segment.shift_id,
                "shift_code": segment.shift.code,
                "courier": segment.courier_id,
                "motorcycle_code": segment.shift.motorcycle.code,
                "lat": lat,
                "lng": lng,
                "accuracy_m": accuracy_m,
                "recorded_at": segment.ended_at_device,
                "received_at": segment.field_event.server_received_at,
            }
        )
    return sorted(rows, key=lambda row: str(row["shift_id"]))


def shift_track(shift: Shift) -> dict[str, Any]:
    """The effective segments of one shift in device order, plus how many segments of it still
    wait in review (stored `in_review`, not voided and without a terminal decision)."""
    segments = (
        effective_segments()
        .filter(shift=shift)
        .select_related("field_event")
        .order_by("started_at_device", "id")
    )
    decided = ReviewDecision.objects.filter(is_terminal=True).values("review_item__field_event_id")
    pending = (
        FieldEvent.objects.filter(
            organization=shift.organization,
            type=TRACK_SEGMENT_EVENT_TYPE,
            shift_id=shift.pk,
            status=EventStatus.IN_REVIEW,
            voided_at__isnull=True,
        )
        .exclude(pk__in=decided)
        .count()
    )
    return {
        "shift_id": shift.pk,
        "status": shift.status,
        "segments": list(segments),
        "pending_review_count": pending,
    }
