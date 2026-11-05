"""Store the catalog code and backfill historical voids as Other, keeping their text.

Atomic DDL ensures a failed backfill rolls back the trigger disable too. On reversal a
catalog-only void uses its code as the legacy text, since the old schema requires text.
"""

from django.db import migrations, models


FORWARD_SQL = """
CREATE OR REPLACE FUNCTION field_sync_fieldevent_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'field events are never deleted';
    END IF;
    IF OLD.voided_at IS NOT NULL
       OR (to_jsonb(NEW) - 'voided_at' - 'voided_by_id' - 'void_reason' - 'void_reason_code')
          IS DISTINCT FROM (to_jsonb(OLD) - 'voided_at' - 'voided_by_id' - 'void_reason' - 'void_reason_code') THEN
        RAISE EXCEPTION 'field events are insert-only (only void them)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

REVERSE_SQL = """
CREATE OR REPLACE FUNCTION field_sync_fieldevent_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'field events are never deleted';
    END IF;
    IF OLD.voided_at IS NOT NULL
       OR (to_jsonb(NEW) - 'voided_at' - 'voided_by_id' - 'void_reason')
          IS DISTINCT FROM (to_jsonb(OLD) - 'voided_at' - 'voided_by_id' - 'void_reason') THEN
        RAISE EXCEPTION 'field events are insert-only (only void them)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""


def backfill_void_codes(apps, schema_editor):
    model = apps.get_model("field_sync", "fieldevent")
    model.objects.using(schema_editor.connection.alias).filter(voided_at__isnull=False).update(
        void_reason_code="other"
    )


def restore_legacy_notes(apps, schema_editor):
    model = apps.get_model("field_sync", "fieldevent")
    model.objects.using(schema_editor.connection.alias).filter(
        voided_at__isnull=False, void_reason=""
    ).update(void_reason=models.F("void_reason_code"))


class Migration(migrations.Migration):
    atomic = True
    dependencies = [
        ("field_sync", "0002_clock_skew_bigint"),
        ("catalogs", "0003_void_reason_catalog"),
    ]
    operations = [
        migrations.AddField(
            model_name="fieldevent",
            name="void_reason_code",
            field=models.CharField(max_length=64, blank=True, default=""),
        ),
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
        migrations.RemoveConstraint(
            model_name="fieldevent",
            name="field_sync_fieldevent_void_fields_consistent",
        ),
        migrations.RunSQL(
            "ALTER TABLE field_sync_fieldevent DISABLE TRIGGER field_sync_fieldevent_guard",
            "ALTER TABLE field_sync_fieldevent ENABLE TRIGGER field_sync_fieldevent_guard",
        ),
        migrations.RunPython(backfill_void_codes, restore_legacy_notes),
        migrations.RunSQL(
            "ALTER TABLE field_sync_fieldevent ENABLE TRIGGER field_sync_fieldevent_guard",
            "ALTER TABLE field_sync_fieldevent DISABLE TRIGGER field_sync_fieldevent_guard",
        ),
        migrations.AddConstraint(
            model_name="fieldevent",
            constraint=models.CheckConstraint(
                name="field_sync_fieldevent_void_fields_consistent",
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
