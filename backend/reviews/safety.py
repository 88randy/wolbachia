"""A pending severe source is a review hold, never an invented fleet fault."""

from uuid import UUID

from django.db.models import QuerySet

from reviews.models import ReviewSourceSnapshot


def _pending_severe_sources() -> QuerySet[ReviewSourceSnapshot]:
    return ReviewSourceSnapshot.objects.filter(
        resource_kind="motorcycle",
        has_severe_observation=True,
        source_event__status="in_review",
        source_event__voided_at__isnull=True,
        source_event__review_effect_receipt__isnull=True,
    ).filter(source_event__review_safety_disposition__isnull=True)


def has_pending_severe_source(source_id: UUID) -> bool:
    return _pending_severe_sources().filter(source_event_id=source_id).exists()


def has_pending_severe(motorcycle_id: UUID, excluding_source: UUID | None = None) -> bool:
    rows = _pending_severe_sources().filter(resource_id=motorcycle_id)
    if excluding_source is not None:
        rows = rows.exclude(source_event_id=excluding_source)
    return rows.exists()
