"""Seed void reasons for every existing organization; preserve all configured labels."""

from django.db import migrations


# [PENDING] Final list to be confirmed by the client/entomologist.
ITEMS = (
    ("data-entry-error", "Error de captura", "Data entry error", 10, False),
    ("duplicate-record", "Registro duplicado", "Duplicate record", 20, False),
    ("wrong-location", "Ubicación incorrecta", "Wrong location", 30, False),
    ("other", "Otro (especificar)", "Other (specify)", 0, True),
)


def seed_void_reasons(apps, schema_editor):
    Organization = apps.get_model("organizations", "Organization")
    Catalog = apps.get_model("catalogs", "Catalog")
    CatalogItem = apps.get_model("catalogs", "CatalogItem")
    alias = schema_editor.connection.alias
    for organization_id in (
        Organization.objects.using(alias).values_list("pk", flat=True).iterator()
    ):
        catalog, _ = Catalog.objects.using(alias).get_or_create(
            organization_id=organization_id,
            slug="void-reason",
            defaults={
                "label_es": "Motivo de anulación",
                "label_en": "Void reason",
                "is_open": True,
            },
        )
        for code, label_es, label_en, sort, is_other in ITEMS:
            CatalogItem.objects.using(alias).get_or_create(
                catalog=catalog,
                code=code,
                defaults={
                    "organization_id": organization_id,
                    "label_es": label_es,
                    "label_en": label_en,
                    "sort": sort,
                    "is_other": is_other,
                },
            )


class Migration(migrations.Migration):
    dependencies = [
        ("catalogs", "0002_item_input_validation"),
        ("organizations", "0003_mark_existing_seeded_profiles"),
    ]
    operations = [migrations.RunPython(seed_void_reasons, migrations.RunPython.noop)]
