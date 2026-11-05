from typing import Any

from django.apps import apps
from django.db.models import Count, IntegerField, OuterRef, Prefetch, QuerySet, Subquery
from django.db.models.expressions import Expression
from django.db.models.functions import Coalesce

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


def _reference_count(queryset: QuerySet[Any], reference: str) -> Coalesce:
    counts = queryset.order_by().values(reference).annotate(total=Count("pk")).values("total")
    return Coalesce(Subquery(counts, output_field=IntegerField()), 0)


def with_item_usage(queryset: QuerySet[CatalogItem], catalog: Catalog) -> QuerySet[CatalogItem]:
    """Sum historical references in correlated subqueries, never one query per item."""
    from shifts.models import MotorcycleCheck

    usage: Expression = _reference_count(
        MotorcycleCheck.objects.filter(
            organization_id=catalog.organization_id, item_id=OuterRef("pk")
        ),
        "item_id",
    )
    if catalog.slug == "void-reason":
        for model in apps.get_models():
            fields = {field.name for field in model._meta.fields}
            if {"organization", "void_reason_code"} <= fields:
                usage = usage + _reference_count(
                    model._default_manager.filter(
                        organization_id=catalog.organization_id,
                        void_reason_code=OuterRef("code"),
                    ),
                    "void_reason_code",
                )
    return queryset.select_related("catalog", "created_by", "deactivated_by").annotate(
        usage_count=usage
    )


def catalog_item_usage_count(item: CatalogItem) -> int:
    """Use the list projection or load a standalone item's committed reference count."""
    if hasattr(item, "usage_count"):
        return int(item.usage_count)
    queryset = CatalogItem.objects.filter(pk=item.pk, organization_id=item.organization_id)
    annotated = with_item_usage(queryset, item.catalog).get()
    return int(getattr(annotated, "usage_count", 0))
