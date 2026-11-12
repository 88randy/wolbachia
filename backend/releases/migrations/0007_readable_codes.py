"""Short human code (LIB-0042) on every release, backfilled by creation time per organization.

The insert-only guard trigger is disabled only around the backfill, inside the migration
transaction; only `code` is written. Reverse drops the column; the counters stay harmlessly.
"""

from django.db import migrations, models

from organizations.code_backfill import BackfillTarget, backfill_codes
from organizations.codes import CodeKind

# Frozen copy: a migration must not change when the live constants do.
RELEASE_CODE = CodeKind("release", "LIB")


def backfill(apps, schema_editor):
    backfill_codes(schema_editor, BackfillTarget("releases_release", "releases_release_guard", RELEASE_CODE))


class Migration(migrations.Migration):
    dependencies = [
        ("organizations", "0008_readable_codes"),
        ("releases", "0006_permit_version_document_unique"),
    ]
    operations = [
        migrations.AddField(
            model_name="release",
            name="code",
            field=models.CharField(default="", editable=False, max_length=50),
            preserve_default=False,
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="release",
            constraint=models.UniqueConstraint(
                fields=("organization", "code"), name="releases_release_code"
            ),
        ),
    ]
