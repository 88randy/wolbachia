from collections.abc import Mapping
from dataclasses import dataclass
from uuid import UUID

from django.db import transaction
from django.db.models import F, Max
from django.utils import timezone

from accounts.models import User
from catalogs.exceptions import (
    CatalogItemLimitError,
    CatalogVersionConflictError,
    OtherItemLockedError,
    ProtectedOtherItemError,
)
from catalogs.models import MAX_SORT, OTHER_ITEM_CODE, Catalog, CatalogItem
from catalogs.selectors import with_item_usage
from core.exceptions import FieldValidationError

# `code`, `is_other` and `is_active` are not editable: the first is the stable identity items
# are referenced by, the others have their own rules (the "Other" item is fixed).
EDITABLE_ITEM_FIELDS = ("label_es", "label_en", "icon", "sort", "requires_photo")
DUPLICATE_CODE = "duplicate_code"
RESERVED_CODE = "reserved_code"
SORT_EXHAUSTED = "sort_exhausted"
# Caps what a phone downloads and what an admin screen lists.
MAX_ACTIVE_ITEMS_PER_CATALOG = 200
FIRST_SORT = 1
REORDER_SORT_STEP = 10


@dataclass(frozen=True)
class CatalogItemSpec:
    """What an admin provides to add an item. An omitted `sort` appends the item at the end."""

    code: str
    label_es: str
    label_en: str = ""
    icon: str = ""
    sort: int | None = None
    requires_photo: bool = False


@dataclass(frozen=True)
class CatalogAvailabilityChange:
    """Availability intent; an omitted version preserves unconditional callers."""

    is_active: bool
    version: int | None = None
    user: User | None = None


def _next_sort(catalog: Catalog) -> int:
    """One after the highest `sort` of the regular items ("Other" is always listed last)."""
    highest = CatalogItem.objects.filter(catalog=catalog, is_active=True, is_other=False).aggregate(
        highest=Max("sort")
    )["highest"]
    next_sort = FIRST_SORT if highest is None else highest + 1
    if next_sort > MAX_SORT:
        raise FieldValidationError("sort", SORT_EXHAUSTED)
    return next_sort


def _ensure_room_for_an_active_item(catalog: Catalog) -> None:
    """Call with the catalog row locked, so concurrent requests cannot both take the last slot."""
    active = CatalogItem.objects.filter(catalog=catalog, is_active=True).count()
    if active >= MAX_ACTIVE_ITEMS_PER_CATALOG:
        raise CatalogItemLimitError


def create_catalog_item(catalog: Catalog, spec: CatalogItemSpec, user: User) -> CatalogItem:
    """Add a regular item to a catalog (writes CatalogItem). Never creates the "Other" item.

    The catalog row is locked so two concurrent requests cannot take the same code, `sort` or
    the last active slot. Errors: `reserved_code` (the code of "Other"), `duplicate_code`,
    `sort_exhausted` (400) and `catalog_item_limit_reached` (409).
    """
    if spec.code == OTHER_ITEM_CODE:
        raise FieldValidationError("code", RESERVED_CODE)
    with transaction.atomic():
        locked = Catalog.objects.select_for_update().get(pk=catalog.pk)
        _ensure_room_for_an_active_item(locked)
        if CatalogItem.objects.filter(catalog=locked, code=spec.code).exists():
            raise FieldValidationError("code", DUPLICATE_CODE)
        sort = spec.sort if spec.sort is not None else _next_sort(locked)
        item = CatalogItem.objects.create(
            organization_id=locked.organization_id,
            catalog=locked,
            code=spec.code,
            label_es=spec.label_es,
            label_en=spec.label_en,
            icon=spec.icon,
            sort=sort,
            requires_photo=spec.requires_photo,
            created_by=user,
        )
        _bump_revision(locked)
        return item


def update_catalog_item(item: CatalogItem, changes: Mapping[str, object]) -> CatalogItem:
    """Apply label, icon, order and photo changes (writes CatalogItem); other keys are ignored."""
    fields = [name for name in EDITABLE_ITEM_FIELDS if name in changes]
    with transaction.atomic():
        catalog, locked = _lock_item(item)
        if locked.is_other and fields:
            raise ProtectedOtherItemError
        for name in fields:
            setattr(locked, name, changes[name])
        if fields:
            locked.save(update_fields=[*fields, "updated_at"])
            _bump_revision(catalog)
    return locked


def deactivate_catalog_item(
    item: CatalogItem, user: User, *, version: int | None = None
) -> CatalogItem:
    """Hide an item from new records (writes CatalogItem). Old records keep showing it.

    Raises `OtherItemLockedError` (409) for the fixed "Other (specify)" item.
    """
    return _set_item_active(item, CatalogAvailabilityChange(False, version, user))


def activate_catalog_item(item: CatalogItem, *, version: int | None = None) -> CatalogItem:
    """Make a deactivated item available again (writes CatalogItem)."""
    return _set_item_active(item, CatalogAvailabilityChange(True, version))


def _set_item_active(item: CatalogItem, change: CatalogAvailabilityChange) -> CatalogItem:
    with transaction.atomic():
        catalog, locked = _lock_item(item)
        if change.version is not None and catalog.revision != change.version:
            raise CatalogVersionConflictError
        if locked.is_other and not change.is_active:
            raise OtherItemLockedError
        if locked.is_active != change.is_active:
            if change.is_active:
                _ensure_room_for_an_active_item(catalog)
            locked.is_active = change.is_active
            locked.deactivated_at = None if change.is_active else timezone.now()
            locked.deactivated_by = None if change.is_active else change.user
            locked.save(
                update_fields=["is_active", "deactivated_at", "deactivated_by", "updated_at"]
            )
            _bump_revision(catalog)
    return locked


def _lock_item(item: CatalogItem) -> tuple[Catalog, CatalogItem]:
    """Global order: Catalog first, then its item; never reuse pre-lock annotations."""
    catalog_id = CatalogItem.objects.values_list("catalog_id", flat=True).get(pk=item.pk)
    catalog = Catalog.objects.select_for_update().get(pk=catalog_id)
    locked = CatalogItem.objects.select_for_update().get(pk=item.pk, catalog=catalog)
    # Preserve this write's revision when serialization happens after the lock is released.
    locked.catalog = catalog
    return catalog, locked


def _bump_revision(catalog: Catalog) -> int:
    """Called only inside a transaction holding this catalog's row lock."""
    Catalog.objects.filter(pk=catalog.pk).update(revision=F("revision") + 1)
    catalog.refresh_from_db(fields=["revision"])
    return catalog.revision


def reorder_catalog_items(  # noqa: PLR0913 -- explicit issue #182 service contract
    catalog: Catalog, version: int, ordered_ids: list[UUID], user: User
) -> tuple[int, list[CatalogItem]]:
    """Atomically replace the active regular order; reject stale or mismatching plans.

    Materialize the full response under the lock so its items match the returned revision.
    Other and inactive items keep their sort. The actor is supplied by the request; reorder
    preserves item authorship (there is no separate reorder audit model).
    """
    with transaction.atomic():
        locked = Catalog.objects.select_for_update().get(pk=catalog.pk)
        if locked.revision != version:
            raise CatalogVersionConflictError
        active = list(
            CatalogItem.objects.select_for_update()
            .filter(catalog=locked, is_active=True, is_other=False)
            .order_by("id")
        )
        by_id = {item.pk: item for item in active}
        if len(ordered_ids) != len(by_id) or set(ordered_ids) != set(by_id):
            raise FieldValidationError("ordered_ids", "reorder_ids_mismatch")
        changed = []
        for position, item_id in enumerate(ordered_ids, start=1):
            item = by_id[item_id]
            sort = position * REORDER_SORT_STEP
            if item.sort != sort:
                item.sort = sort
                changed.append(item)
        CatalogItem.objects.bulk_update(changed, ["sort"])
        revision = _bump_revision(locked)
        return revision, list(with_item_usage(locked.items.all(), locked))
