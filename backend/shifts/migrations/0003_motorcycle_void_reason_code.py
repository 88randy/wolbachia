"""Store the catalog code of a voided motorcycle and backfill historical voids as Other.

A motorcycle has no immutability trigger, so the backfill is a plain update. On reversal a
catalog-only void uses its code as the legacy text, since the old schema requires text.
"""

from django.db import migrations, models


def backfill_void_codes(apps, schema_editor):
    model = apps.get_model("shifts", "motorcycle")
    model.objects.using(schema_editor.connection.alias).filter(voided_at__isnull=False).update(
        void_reason_code="other"
    )


def restore_legacy_notes(apps, schema_editor):
    model = apps.get_model("shifts", "motorcycle")
    model.objects.using(schema_editor.connection.alias).filter(
        voided_at__isnull=False, void_reason=""
    ).update(void_reason=models.F("void_reason_code"))


class Migration(migrations.Migration):
    atomic = True
    dependencies = [
        ("shifts", "0002_motorcycleblockevent_motorcycle_void_reason_and_more"),
        ("catalogs", "0003_void_reason_catalog"),
    ]
    operations = [
        migrations.AddField(
            model_name="motorcycle",
            name="void_reason_code",
            field=models.CharField(max_length=64, blank=True, default=""),
        ),
        migrations.RemoveConstraint(
            model_name="motorcycle", name="shifts_motorcycle_void_fields_consistent"
        ),
        migrations.RunPython(backfill_void_codes, restore_legacy_notes),
        migrations.AddConstraint(
            model_name="motorcycle",
            constraint=models.CheckConstraint(
                name="shifts_motorcycle_void_fields_consistent",
                condition=(
                    models.Q(
                        voided_at__isnull=True,
                        voided_by__isnull=True,
                        void_reason="",
                        void_reason_code="",
                    )
                    | (
                        models.Q(voided_at__isnull=False, voided_by__isnull=False)
                        & ~models.Q(void_reason_code="")
                        & (~models.Q(void_reason="") | ~models.Q(void_reason_code="other"))
                    )
                ),
            ),
        ),
    ]
