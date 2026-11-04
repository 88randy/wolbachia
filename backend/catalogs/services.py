from collections.abc import Mapping
from dataclasses import dataclass

from django.db import transaction
from django.db.models import Max

from accounts.models import User
from catalogs.exceptions import OtherItemLockedError
from catalogs.models import Catalog, CatalogItem
from core.exceptions import FieldValidationError
from core.services import lock_record_for_update

# `code`, `is_other` and `is_active` are not editable: the first is the stable identity items
# are referenced by, the others have their own rules (the "Other" item is fixed).
EDITABLE_ITEM_FIELDS = ("label_es", "label_en", "icon", "sort", "requires_photo")
DUPLICATE_CODE = "duplicate_code"
FIRST_SORT = 1


@dataclass(frozen=True)
class CatalogItemSpec:
    """What an admin provides to add an item. An omitted `sort` appends the item at the end."""

    code: str
    label_es: str
    label_en: str = ""
    icon: str = ""
    sort: int | None = None
    requires_photo: bool = False


def _next_sort(catalog: Catalog) -> int:
    """One after the highest `sort` of the regular items ("Other" is always listed last)."""
    highest = CatalogItem.objects.filter(catalog=catalog, is_other=False).aggregate(
        highest=Max("sort")
    )["highest"]
    return FIRST_SORT if highest is None else highest + 1


def create_catalog_item(catalog: Catalog, spec: CatalogItemSpec, user: User) -> CatalogItem:
    """Add a regular item to a catalog (writes CatalogItem). Never creates the "Other" item.

    The catalog row is locked so two concurrent requests cannot take the same code or `sort`.
    """
    with transaction.atomic():
        locked = Catalog.objects.select_for_update().get(pk=catalog.pk)
        if CatalogItem.objects.filter(catalog=locked, code=spec.code).exists():
            raise FieldValidationError("code", DUPLICATE_CODE)
        sort = spec.sort if spec.sort is not None else _next_sort(locked)
        return CatalogItem.objects.create(
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


def update_catalog_item(item: CatalogItem, changes: Mapping[str, object]) -> CatalogItem:
    """Apply label, icon, order and photo changes (writes CatalogItem); other keys are ignored."""
    fields = [name for name in EDITABLE_ITEM_FIELDS if name in changes]
    with transaction.atomic():
        locked = lock_record_for_update(item)
        for name in fields:
            setattr(locked, name, changes[name])
        if fields:
            locked.save(update_fields=[*fields, "updated_at"])
    return locked


def deactivate_catalog_item(item: CatalogItem) -> CatalogItem:
    """Hide an item from new records (writes CatalogItem). Old records keep showing it.

    Raises `OtherItemLockedError` (409) for the fixed "Other (specify)" item.
    """
    return _set_item_active(item, is_active=False)


def activate_catalog_item(item: CatalogItem) -> CatalogItem:
    """Make a deactivated item available again (writes CatalogItem)."""
    return _set_item_active(item, is_active=True)


def _set_item_active(item: CatalogItem, *, is_active: bool) -> CatalogItem:
    with transaction.atomic():
        locked = lock_record_for_update(item)
        if locked.is_other and not is_active:
            raise OtherItemLockedError
        if locked.is_active != is_active:
            locked.is_active = is_active
            locked.save(update_fields=["is_active", "updated_at"])
    return locked
