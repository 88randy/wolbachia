"""Default catalogs of a new organization. Safe to run twice; it never overwrites admin edits.

[PENDING #35] The launch list of catalogs and which are open or closed is not confirmed by the
client. Open catalogs start with the fixed "Other (specify)" item only: admins add the real items.
"""

from dataclasses import dataclass

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
    CatalogSeed("removal-reason", "Motivo de retiro", "Removal reason"),
    CatalogSeed("replacement-reason", "Motivo de reposición", "Replacement reason"),
    CatalogSeed("damage-reason", "Motivo de daño", "Damage reason"),
    CatalogSeed("ovitrap-finding", "Hallazgo en ovitrampa", "Ovitrap finding", is_open=False),
    CatalogSeed("intervention-type", "Tipo de intervención", "Intervention type"),
)


def missing_catalog_slugs(organization: Organization) -> list[str]:
    """Read-only: default catalogs the organization does not have yet."""
    existing = set(Catalog.objects.filter(organization=organization).values_list("slug", flat=True))
    return [seed.slug for seed in DEFAULT_CATALOG_SEEDS if seed.slug not in existing]


def seed_default_catalogs(organization: Organization) -> list[Catalog]:
    """Create the default catalogs and the "Other" item of the open ones (writes Catalog, CatalogItem)."""
    catalogs = []
    for seed in DEFAULT_CATALOG_SEEDS:
        catalog, _ = Catalog.objects.get_or_create(
            organization=organization,
            slug=seed.slug,
            defaults={
                "label_es": seed.label_es,
                "label_en": seed.label_en,
                "is_open": seed.is_open,
            },
        )
        if catalog.is_open:
            _ensure_other_item(catalog)
        catalogs.append(catalog)
    return catalogs


def _ensure_other_item(catalog: Catalog) -> None:
    CatalogItem.objects.get_or_create(
        catalog=catalog,
        is_other=True,
        defaults={
            "organization_id": catalog.organization_id,
            "code": OTHER_ITEM_CODE,
            "label_es": OTHER_ITEM_LABEL_ES,
            "label_en": OTHER_ITEM_LABEL_EN,
        },
    )
