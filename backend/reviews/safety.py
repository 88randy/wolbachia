"""A pending severe source is a review hold, never an invented fleet fault."""

from uuid import UUID

from reviews.models import ReviewSourceSnapshot


def has_pending_severe(motorcycle_id: UUID, excluding_source: UUID | None = None) -> bool:
    rows = ReviewSourceSnapshot.objects.filter(
        resource_kind="motorcycle",
        resource_id=motorcycle_id,
        has_severe_observation=True,
        source_event__status="in_review",
        source_event__voided_at__isnull=True,
        source_event__review_effect_receipt__isnull=True,
    ).filter(source_event__review_safety_disposition__isnull=True)
    if excluding_source is not None:
        rows = rows.exclude(source_event_id=excluding_source)
    return rows.exists()
