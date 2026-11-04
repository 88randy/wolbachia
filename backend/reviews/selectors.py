from dataclasses import dataclass

from django.conf import settings
from django.db.models import QuerySet

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
class ReviewPage:
    """One page of review items in inbox order and whether more follow."""

    items: list[ReviewItem]
    has_more: bool


def list_courier_reviews(
    organization: Organization, courier: User, after_sequence: int
) -> ReviewPage:
    """A courier's review items with `courier_sequence` above `after_sequence`, in that order
    (one page: `API_CURSOR_PAGE_SIZE`). Position is the sequence only, never a timestamp."""
    limit = settings.API_CURSOR_PAGE_SIZE
    items = (
        ReviewItem.objects.for_org(organization)
        .filter(courier=courier, courier_sequence__gt=after_sequence)
        .order_by("courier_sequence")
    )
    rows = list(items[: limit + 1])
    return ReviewPage(items=rows[:limit], has_more=len(rows) > limit)
