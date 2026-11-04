import uuid
from dataclasses import dataclass
from datetime import datetime

from django.conf import settings
from django.db.models import Q, QuerySet

from accounts.models import User
from organizations.models import Organization
from reviews.models import ReviewItem


def list_review_items(
    organization: Organization, kind: str | None = None, code: str | None = None
) -> QuerySet[ReviewItem]:
    """The organization's review items, newest first, optionally of one kind and/or one code."""
    items = ReviewItem.objects.for_org(organization).order_by("-created_at", "-id")
    if kind is not None:
        items = items.filter(kind=kind)
    if code is not None:
        items = items.filter(code=code)
    return items


@dataclass(frozen=True)
class ReviewPosition:
    """Where to start reading a courier's review items: after `created_at` alone, or after the
    keyset position `(created_at, item_id)`. The default starts from the first item."""

    created_at: datetime | None = None
    item_id: uuid.UUID | None = None


@dataclass(frozen=True)
class ReviewPage:
    """One page of review items, oldest first, and whether more follow."""

    items: list[ReviewItem]
    has_more: bool


def list_courier_reviews(
    organization: Organization, courier: User, after: ReviewPosition
) -> ReviewPage:
    """A courier's review items, oldest first, after a position (one page: `API_CURSOR_PAGE_SIZE`).

    `after.created_at` alone means "created after it"; with `after.item_id` it is the keyset
    position `(created_at, id) > (created_at, item_id)`. Without it, from the first item.
    """
    limit = settings.API_CURSOR_PAGE_SIZE
    items = ReviewItem.objects.for_org(organization).filter(courier=courier)
    if after.created_at is not None:
        newer = Q(created_at__gt=after.created_at)
        if after.item_id is not None:
            newer |= Q(created_at=after.created_at, id__gt=after.item_id)
        items = items.filter(newer)
    rows = list(items.order_by("created_at", "id")[: limit + 1])
    return ReviewPage(items=rows[:limit], has_more=len(rows) > limit)
