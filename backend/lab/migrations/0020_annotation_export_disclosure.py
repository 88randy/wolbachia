"""Expand numeric disclosure surfaces without changing retained exposure facts."""

from importlib import import_module

from django.apps.registry import Apps
from django.db import migrations, models
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.exceptions import IrreversibleError

PRIOR = import_module("lab.migrations.0005_independent_qa_guards")
OLD_GUARD = PRIOR.INSERT_GUARD.replace(
    "CREATE FUNCTION lab_qa_insert_guard()", "CREATE OR REPLACE FUNCTION lab_qa_insert_guard()", 1
)
OLD_BOUNDARY = "NEW.surface NOT IN ('result','void_context','request','history','replay','physical_assessment')"
NEW_BOUNDARY = "NEW.surface NOT IN ('result','void_context','request','history','replay','physical_assessment','annotation_export')"
if OLD_GUARD.count(OLD_BOUNDARY) != 1:
    raise ValueError("The canonical numeric disclosure boundary changed.")
NEW_GUARD = OLD_GUARD.replace(OLD_BOUNDARY, NEW_BOUNDARY, 1)


def protect_reverse(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    # Keep inserts blocked through guard restoration, without blocking ordinary readers.
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("SET LOCAL lock_timeout = '2s'")
        cursor.execute("LOCK TABLE lab_labnumericdisclosure IN SHARE MODE")
    disclosures = apps.get_model("lab", "LabNumericDisclosure")
    if (
        disclosures.objects.using(schema_editor.connection.alias)
        .filter(surface="annotation_export")
        .exists()
    ):
        raise IrreversibleError("Retain immutable annotation export disclosure facts.")


class Migration(migrations.Migration):
    dependencies = [("lab", "0019_annotation_export_expiry")]
    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunSQL(NEW_GUARD, OLD_GUARD)],
            state_operations=[
                migrations.AlterField(
                    model_name="labnumericdisclosure",
                    name="surface",
                    field=models.CharField(
                        max_length=24,
                        choices=[
                            (value, value)
                            for value in (
                                "result",
                                "void_context",
                                "request",
                                "history",
                                "replay",
                                "physical_assessment",
                                "annotation_export",
                            )
                        ],
                    ),
                )
            ],
        ),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
