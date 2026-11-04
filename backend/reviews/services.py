from field_sync.models import EventStatus, FieldEvent
from reviews.models import ReviewItem, ReviewKind


def create_review_item(event: FieldEvent) -> ReviewItem:
    """Open the review item of a rejected or in-review event (writes ReviewItem, insert-only).

    Call it in the same savepoint that stores the event, so one never exists without the other.
    The courier is the event's author: events always come from a user's session.
    """
    kind = ReviewKind.REJECTED if event.status == EventStatus.REJECTED else ReviewKind.IN_REVIEW
    author_id = event.created_by_id
    if author_id is None:
        raise ValueError("A field event always has an author.")
    return ReviewItem.objects.create(
        organization_id=event.organization_id,
        created_by_id=author_id,
        field_event=event,
        kind=kind,
        code=event.status_code,
        params=event.status_params,
        event_type=event.type,
        courier_id=author_id,
        device_id=event.device_id,
    )
