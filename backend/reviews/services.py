from django.db.models import Max

from accounts.models import User
from field_sync.models import EventStatus, FieldEvent
from organizations.models import Organization
from reviews.models import ReviewItem, ReviewKind


def next_courier_sequence(organization: Organization, courier: User) -> int:
    """The next position in a courier's inbox: `max + 1` (reads).

    **Rule for every writer of review items:** call it only while holding the courier's batch
    lock (`field_sync.services.lock_courier_batches`) and assign it through
    `create_review_item`. The lock is what makes `max + 1` unique and gap-free in commit order;
    the unique constraint only catches a writer that forgot it. A counter row would need the
    same lock, so it would add a table without adding safety.
    """
    newest = (
        ReviewItem.objects.for_org(organization)
        .filter(courier=courier)
        .aggregate(newest=Max("courier_sequence"))["newest"]
    )
    return int(newest or 0) + 1


def create_review_item(event: FieldEvent) -> ReviewItem:
    """Open the review item of a rejected or in-review event (writes ReviewItem, insert-only).

    Call it in the same savepoint that stores the event, so one never exists without the other,
    and only while holding the courier's batch lock (it assigns `courier_sequence`).
    The courier is the event's author: events always come from a user's session.
    """
    kind = ReviewKind.REJECTED if event.status == EventStatus.REJECTED else ReviewKind.IN_REVIEW
    author = event.created_by
    if author is None:
        raise ValueError("A field event always has an author.")
    author_id = author.pk
    return ReviewItem.objects.create(
        organization_id=event.organization_id,
        created_by_id=author_id,
        field_event=event,
        kind=kind,
        code=event.status_code,
        params=event.status_params,
        event_type=event.type,
        courier_id=author_id,
        courier_sequence=next_courier_sequence(event.organization, author),
        device_id=event.device_id,
    )
