import uuid
from dataclasses import dataclass, field
from typing import Any

from catalogs.selectors import build_catalog_snapshot
from core.time import server_now
from field_sync.cursor import ChangesCursor, encode_cursor
from field_sync.envelope import BatchContext
from field_sync.models import FieldEvent
from reviews.models import ReviewItem
from reviews.selectors import ReviewPosition, list_courier_reviews
from rules.selectors import build_rules_snapshot


@dataclass(frozen=True)
class StoredEvent:
    """The columns of an already stored event that idempotency needs. Nothing else is read."""

    organization_id: uuid.UUID
    device_id: uuid.UUID
    created_by_id: uuid.UUID | None
    payload_sha256: str
    status: str
    status_code: str
    status_params: dict[str, Any]


def find_stored_event(event_id: uuid.UUID) -> StoredEvent | None:
    """The stored event with this id in ANY organization, or None.

    Deliberately not scoped: an id is globally unique (it is the primary key), so a reused id of
    another organization or device must be detected to answer `event_id_conflict`. The caller
    compares the owner and returns a result; the row itself never leaves the service.
    """
    row = (
        FieldEvent.objects.filter(pk=event_id)
        .values(
            "organization_id",
            "device_id",
            "created_by_id",
            "payload_sha256",
            "status",
            "status_code",
            "status_params",
        )
        .first()
    )
    return None if row is None else StoredEvent(**row)


@dataclass(frozen=True)
class Changes:
    """The downstream part of a sync answer. `cursor` and the versions are None only when the
    answer is empty on purpose (a revoked phone's final upload)."""

    cursor: str | None = None
    reviews: list[ReviewItem] = field(default_factory=list)
    catalog_version: str | None = None
    rules_version: str | None = None
    has_more: bool = False


def build_changes(batch: BatchContext, cursor: ChangesCursor) -> Changes:
    """What the phone has not seen yet: its review items after the cursor, and the versions of
    the catalog and rules snapshots (the phone refreshes them when they changed).

    Scoped to the batch's organization and user. At most one page (`API_CURSOR_PAGE_SIZE`);
    `has_more` tells the phone to pull again. Call it inside the courier's batch lock (see
    `field_sync.services.sync_batch`): that is what makes the strict cursor gap-free.
    """
    organization, user = batch.organization, batch.user
    page = list_courier_reviews(
        organization, user, ReviewPosition(cursor.created_at, cursor.item_id)
    )
    if page.items:
        last = page.items[-1]
        cursor = ChangesCursor(last.created_at, last.pk)
    return Changes(
        cursor=encode_cursor(organization.pk, user.pk, cursor),
        reviews=page.items,
        catalog_version=str(build_catalog_snapshot(organization)["version"]),
        rules_version=str(build_rules_snapshot(organization, server_now())["version"]),
        has_more=page.has_more,
    )
