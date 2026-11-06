"""Expand the feed CHECK without rewriting rows or holding a scan under ACCESS EXCLUSIVE.

Rollback deliberately refuses while new-kind immutable rows exist: it never deletes history.
Stop producers and roll back before ingesting these kinds if a downgrade is required.
"""

from django.db import migrations, models

OLD_KINDS = ["assignments", "supplies", "permits", "eligibility", "history", "map_manifests"]
NEW_KINDS = [*OLD_KINDS, "quadrants", "sampling_points", "ovitraps"]

FORWARD = """
ALTER TABLE field_sync_courierchange ADD CONSTRAINT courier_change_kind_196
CHECK (kind IN ('assignments', 'supplies', 'permits', 'eligibility', 'history',
'map_manifests', 'quadrants', 'sampling_points', 'ovitraps')) NOT VALID;
"""
VALIDATE = "ALTER TABLE field_sync_courierchange VALIDATE CONSTRAINT courier_change_kind_196;"
SWAP = """
ALTER TABLE field_sync_courierchange DROP CONSTRAINT courier_change_kind_valid;
ALTER TABLE field_sync_courierchange RENAME CONSTRAINT courier_change_kind_196 TO courier_change_kind_valid;
"""
RESTORE = """
DO $$ BEGIN
    ALTER TABLE field_sync_courierchange RENAME CONSTRAINT courier_change_kind_valid TO courier_change_kind_196;
    ALTER TABLE field_sync_courierchange ADD CONSTRAINT courier_change_kind_valid
    CHECK (kind IN ('assignments', 'supplies', 'permits', 'eligibility', 'history', 'map_manifests')) NOT VALID;
    ALTER TABLE field_sync_courierchange VALIDATE CONSTRAINT courier_change_kind_valid;
END $$;
"""


class Migration(migrations.Migration):
    atomic = False
    dependencies = [("field_sync", "0005_courierchange")]
    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    FORWARD,
                    "ALTER TABLE field_sync_courierchange DROP CONSTRAINT courier_change_kind_196;",
                ),
                migrations.RunSQL(VALIDATE, migrations.RunSQL.noop),
                migrations.RunSQL(SWAP, RESTORE),
            ],
            state_operations=[
                migrations.RemoveConstraint(
                    model_name="courierchange", name="courier_change_kind_valid"
                ),
                migrations.AddConstraint(
                    model_name="courierchange",
                    constraint=models.CheckConstraint(
                        condition=models.Q(kind__in=NEW_KINDS), name="courier_change_kind_valid"
                    ),
                ),
            ],
        ),
    ]
