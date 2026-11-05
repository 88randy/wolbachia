"""Store the catalog code and backfill historical voids as Other, keeping their text.

Atomic DDL ensures a failed backfill rolls back the trigger disable too. On reversal a
catalog-only void uses its code as the legacy text, since the old schema requires text.
"""

from django.db import migrations, models


def backfill_void_codes(apps, schema_editor):
    model = apps.get_model("testapp", "widget")
    model.objects.using(schema_editor.connection.alias).filter(voided_at__isnull=False).update(
        void_reason_code="other"
    )


def restore_legacy_notes(apps, schema_editor):
    model = apps.get_model("testapp", "widget")
    model.objects.using(schema_editor.connection.alias).filter(
        voided_at__isnull=False, void_reason=""
    ).update(void_reason=models.F("void_reason_code"))


class Migration(migrations.Migration):
    atomic = True
    dependencies = [
        ("testapp", "0002_widget_code"),
        ("catalogs", "0003_void_reason_catalog"),
    ]
    operations = [
        migrations.AddField(
            model_name="widget",
            name="void_reason_code",
            field=models.CharField(max_length=64, blank=True, default=""),
        ),
        migrations.RemoveConstraint(
            model_name="widget",
            name="testapp_widget_void_fields_consistent",
        ),
        migrations.RunPython(backfill_void_codes, restore_legacy_notes),
        migrations.AddConstraint(
            model_name="widget",
            constraint=models.CheckConstraint(
                name="testapp_widget_void_fields_consistent",
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
