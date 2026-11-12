"""Short human code (JOR-0128) on every shift, backfilled by creation time per organization.

The insert-only guard trigger is disabled only around the backfill, inside the migration
transaction; only `code` is written. Reverse drops the column; the counters stay harmlessly.
"""

from django.db import migrations, models

from organizations.code_backfill import BackfillTarget, backfill_codes
from organizations.codes import CodeKind

# Frozen copy: a migration must not change when the live constants do.
SHIFT_CODE = CodeKind("shift", "JOR")


def backfill(apps, schema_editor):
    backfill_codes(schema_editor, BackfillTarget("shifts_shift", "shifts_shift_guard", SHIFT_CODE))


class Migration(migrations.Migration):
    dependencies = [
        ("organizations", "0008_readable_codes"),
        ("shifts", "0004_motorcycle_center_motorcycle_revision"),
    ]
    operations = [
        migrations.AddField(
            model_name="shift",
            name="code",
            field=models.CharField(default="", editable=False, max_length=50),
            preserve_default=False,
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="shift",
            constraint=models.UniqueConstraint(
                fields=("organization", "code"), name="shift_unique_code_per_organization"
            ),
        ),
    ]
