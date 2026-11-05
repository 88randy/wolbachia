from typing import Any

from django.db.models import Prefetch, QuerySet

from catalogs.models import Catalog, CatalogItem
from core.snapshots import with_version
from organizations.models import Organization
from shifts.selectors import list_snapshot_motorcycles


def list_catalogs(organization: Organization) -> QuerySet[Catalog]:
    return Catalog.objects.for_org(organization).order_by("slug")


def _snapshot_item(item: CatalogItem) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "code": item.code,
        "label_es": item.label_es,
        "label_en": item.label_en,
        "icon": item.icon,
        "sort": item.sort,
        "is_other": item.is_other,
        "requires_photo": item.requires_photo,
    }


def build_catalog_snapshot(organization: Organization) -> dict[str, Any]:
    """Every catalog with its active items, plus the `version` hash of that content.

    Only active items are included: a phone must not offer an item an admin switched off.
    """
    active_items = Prefetch("items", queryset=CatalogItem.objects.filter(is_active=True))
    catalogs = [
        {
            "slug": catalog.slug,
            "label_es": catalog.label_es,
            "label_en": catalog.label_en,
            "is_open": catalog.is_open,
            "items": [_snapshot_item(item) for item in catalog.items.all()],
        }
        for catalog in list_catalogs(organization).prefetch_related(active_items)
    ]
    return with_version(
        {"catalogs": catalogs, "motorcycles": list_snapshot_motorcycles(organization)}
    )
