"""Short human code (OVT-0001) on every ovitrap, plus the pool of pre-registered labels.

The insert-only guard trigger of `ovitraps_ovitrap` is disabled only around the backfill, inside
the migration transaction; only `code` is written. Reverse drops the column and the label table;
the counters stay harmlessly.
"""

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

from organizations.code_backfill import BackfillTarget, backfill_codes
from organizations.codes import CodeKind

# Frozen copy: a migration must not change when the live constants do.
OVITRAP_CODE = CodeKind("ovitrap", "OVT")

GUARD_SQL = (
    "CREATE TRIGGER ovitraps_ovitraplabel_guard BEFORE UPDATE OR DELETE ON ovitraps_ovitraplabel "
    "FOR EACH ROW EXECUTE FUNCTION ovitrap_insert_only_guard();"
)
GUARD_REVERSE_SQL = "DROP TRIGGER ovitraps_ovitraplabel_guard ON ovitraps_ovitraplabel;"


def backfill(apps, schema_editor):
    backfill_codes(
        schema_editor, BackfillTarget("ovitraps_ovitrap", "ovitraps_ovitrap_guard", OVITRAP_CODE)
    )


class Migration(migrations.Migration):
    dependencies = [
        ("organizations", "0008_readable_codes"),
        ("ovitraps", "0005_relocationdecision_published_point_version_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.AddField(
            model_name="ovitrap",
            name="code",
            field=models.CharField(default="", editable=False, max_length=50),
            preserve_default=False,
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="ovitrap",
            constraint=models.UniqueConstraint(
                fields=("organization", "code"), name="ovitraps_ovitrap_code"
            ),
        ),
        migrations.CreateModel(
            name="OvitrapLabel",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("client_uuid", models.UUIDField(editable=False)),
                ("code", models.CharField(editable=False, max_length=50)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "organization",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="+",
                        to="organizations.organization",
                    ),
                ),
            ],
            options={
                "abstract": False,
                "base_manager_name": "objects",
                "constraints": [
                    models.UniqueConstraint(
                        fields=("organization", "client_uuid"), name="ovitraps_label_client_uuid"
                    ),
                    models.UniqueConstraint(
                        fields=("organization", "code"), name="ovitraps_label_code"
                    ),
                ],
            },
        ),
        migrations.RunSQL(GUARD_SQL, GUARD_REVERSE_SQL),
    ]
