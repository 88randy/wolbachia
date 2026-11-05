"""Default catalogs of a new organization. Safe to run twice; it never overwrites admin edits.

OP01 confirms the nine launch catalogs; decision 91 retains the additional #80 void catalog.
Closed lists have actual launch checks/findings. Seeds preserve labels and deactivations.
"""

from dataclasses import dataclass
from typing import Any

from django.db import transaction
from django.db.models import F

from catalogs.models import OTHER_ITEM_CODE, Catalog, CatalogItem
from organizations.models import Organization

OTHER_ITEM_LABEL_ES = "Otro (especificar)"
OTHER_ITEM_LABEL_EN = "Other (specify)"


@dataclass(frozen=True)
class CatalogSeed:
    slug: str
    label_es: str
    label_en: str
    is_open: bool = True


DEFAULT_CATALOG_SEEDS = (
    CatalogSeed("incident-type", "Tipos de incidencia", "Incident types"),
    CatalogSeed(
        "motorcycle-check-item", "Revisión de motocicleta", "Motorcycle checklist", is_open=False
    ),
    CatalogSeed("sample-origin", "Origen de la muestra", "Sample origin"),
    CatalogSeed(
        "community-activity-type", "Tipo de actividad comunitaria", "Community activity type"
    ),
    CatalogSeed("void-reason", "Motivo de anulación", "Void reason"),
    CatalogSeed("removal-reason", "Motivo de retiro", "Removal reason"),
    CatalogSeed("replacement-reason", "Motivo de reposición", "Replacement reason"),
    CatalogSeed("damage-reason", "Motivo de daño", "Damage reason"),
    CatalogSeed("ovitrap-finding", "Hallazgo en ovitrampa", "Ovitrap finding", is_open=False),
    CatalogSeed("paddle-type", "Tipo de papeleta", "Egg paddle type"),
    CatalogSeed("intervention-type", "Tipo de intervención", "Intervention type"),
)


def missing_catalog_slugs(organization: Organization) -> list[str]:
    """Read-only: catalogs or launch items the idempotent seed would add."""
    existing = {
        catalog.slug: catalog
        for catalog in Catalog.objects.filter(organization=organization).prefetch_related("items")
    }
    return [
        seed.slug
        for seed in DEFAULT_CATALOG_SEEDS
        if _needs_catalog_seed(existing.get(seed.slug), seed)
    ]


def _needs_catalog_seed(catalog: Catalog | None, seed: CatalogSeed) -> bool:
    if catalog is None:
        return True
    required = {OTHER_ITEM_CODE} if catalog.is_open or seed.slug == "ovitrap-finding" else set()
    if seed.slug == "void-reason":
        required.update(row[0] for row in VOID_REASON_ITEMS)
    required.update(row[0] for row in CLOSED_CATALOG_ITEMS.get(seed.slug, ()))
    return not required <= {item.code for item in catalog.items.all()}


def seed_default_catalogs(organization: Organization) -> list[Catalog]:
    """Seed atomically in Organization -> Catalog -> item order, including direct calls."""
    with transaction.atomic():
        Organization.objects.select_for_update(no_key=True).get(pk=organization.pk)
        return [_seed_catalog(organization, seed) for seed in DEFAULT_CATALOG_SEEDS]


def _seed_catalog(organization: Organization, seed: CatalogSeed) -> Catalog:
    catalog, _ = Catalog.objects.get_or_create(
        organization=organization,
        slug=seed.slug,
        defaults={
            "label_es": seed.label_es,
            "label_en": seed.label_en,
            "is_open": seed.is_open,
        },
    )
    # Lock before item reads/inserts: unique-index waits must not invert deferred FK locks.
    locked = Catalog.objects.select_for_update().get(pk=catalog.pk, organization=organization)
    if locked.is_open or locked.slug == "ovitrap-finding":
        _ensure_other_item(locked)
    if locked.slug == "void-reason":
        _seed_void_reason_items(locked)
    _seed_closed_items(locked)
    return locked


def _ensure_other_item(catalog: Catalog) -> None:
    _create_seed_item(
        catalog=catalog,
        code=OTHER_ITEM_CODE,
        defaults={
            "is_other": True,
            "organization_id": catalog.organization_id,
            "label_es": OTHER_ITEM_LABEL_ES,
            "label_en": OTHER_ITEM_LABEL_EN,
        },
    )


# [PENDING] The client/entomologist will confirm the final list; never overwrite admin edits.
VOID_REASON_ITEMS = (
    ("data-entry-error", "Error de captura", "Data entry error", 10),
    ("duplicate-record", "Registro duplicado", "Duplicate record", 20),
    ("wrong-location", "Ubicación incorrecta", "Wrong location", 30),
)


def _seed_void_reason_items(catalog: Catalog) -> None:
    for code, label_es, label_en, sort in VOID_REASON_ITEMS:
        _create_seed_item(
            catalog=catalog,
            code=code,
            defaults={
                "organization_id": catalog.organization_id,
                "label_es": label_es,
                "label_en": label_en,
                "sort": sort,
            },
        )


# Operational launch items; never count an empty checklist as a completed safety check.
CLOSED_CATALOG_ITEMS = {
    "motorcycle-check-item": (
        ("brakes", "Frenos", "Brakes"),
        ("tires", "Llantas", "Tires"),
        ("lights", "Luces", "Lights"),
        ("horn", "Claxon", "Horn"),
        ("mirrors", "Espejos", "Mirrors"),
        ("fuel", "Combustible", "Fuel"),
    ),
    "paddle-type": (("standard", "Estándar", "Standard"),),
    "ovitrap-finding": (
        ("intact", "Intacta", "Intact"),
        ("dry", "Seca", "Dry"),
        ("damaged", "Dañada", "Damaged"),
        ("missing", "No encontrada", "Missing"),
        ("closed-house", "Casa cerrada", "Closed house"),
        ("absent", "Ausente", "Absent"),
        ("destroyed", "Destruida", "Destroyed"),
    ),
}


def _seed_closed_items(catalog: Catalog) -> None:
    for sort, (code, label_es, label_en) in enumerate(
        CLOSED_CATALOG_ITEMS.get(catalog.slug, ()), start=1
    ):
        _create_seed_item(
            catalog=catalog,
            code=code,
            defaults={
                "organization_id": catalog.organization_id,
                "label_es": label_es,
                "label_en": label_en,
                "sort": sort,
            },
        )


def _create_seed_item(*, catalog: Catalog, code: str, defaults: dict[str, Any]) -> None:
    """The caller holds Catalog; only inserted seed items invalidate existing reorder plans."""
    _, is_created = CatalogItem.objects.get_or_create(catalog=catalog, code=code, defaults=defaults)
    if is_created:
        Catalog.objects.filter(pk=catalog.pk).update(revision=F("revision") + 1)
        catalog.revision += 1
