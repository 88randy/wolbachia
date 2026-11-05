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


def with_item_usage(queryset: QuerySet[CatalogItem], catalog: Catalog) -> QuerySet[CatalogItem]:
    """Project actual historical references in the list query, avoiding per-item lookups."""
    from django.apps import apps
    from django.db.models import Exists, OuterRef, Q

    from shifts.models import MotorcycleCheck

    usage = Q(
        Exists(
            MotorcycleCheck.objects.filter(
                organization_id=catalog.organization_id, item_id=OuterRef("pk")
            )
        )
    )
    if catalog.slug == "void-reason":
        for model in apps.get_models():
            fields = {field.name for field in model._meta.fields}
            if {"organization", "void_reason_code"} <= fields:
                usage |= Q(
                    Exists(
                        model._default_manager.filter(
                            organization_id=catalog.organization_id,
                            void_reason_code=OuterRef("code"),
                        )
                    )
                )
    return queryset.select_related("catalog").annotate(is_in_use=usage)


def catalog_item_is_in_use(item: CatalogItem) -> bool:
    """Use the list projection or resolve a standalone item's actual committed references."""
    if hasattr(item, "is_in_use"):
        return bool(item.is_in_use)
    queryset = CatalogItem.objects.filter(pk=item.pk, organization_id=item.organization_id)
    annotated = with_item_usage(queryset, item.catalog).get()
    return bool(getattr(annotated, "is_in_use", False))
