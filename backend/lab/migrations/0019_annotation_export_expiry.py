"""Expand retained export history with an irreversible ready-to-expired fact."""

from django.apps.registry import Apps
from django.db import migrations, models
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.exceptions import IrreversibleError

FORWARD_SQL = r"""
CREATE OR REPLACE FUNCTION annotation_export_status_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous_revision integer; previous_status text; images bigint; boxes bigint; points bigint;
BEGIN
  PERFORM 1 FROM lab_eggannotationexport WHERE id=NEW.export_id FOR NO KEY UPDATE;
  SELECT revision,status INTO previous_revision,previous_status FROM lab_eggannotationexportstatus
    WHERE export_id=NEW.export_id ORDER BY revision DESC LIMIT 1;
  IF NEW.revision <> coalesce(previous_revision+1,0)
    OR (NEW.status='queued' AND NEW.revision<>0)
    OR (NEW.status='running' AND (NEW.revision<>1 OR previous_status IS DISTINCT FROM 'queued'))
    OR (NEW.status IN ('ready','failed') AND (NEW.revision<>2 OR previous_status IS DISTINCT FROM 'running'))
    OR (NEW.status='expired' AND (NEW.revision<>3 OR previous_status IS DISTINCT FROM 'ready')) THEN
    RAISE EXCEPTION 'Invalid annotation export transition' USING ERRCODE='23514';
  END IF;
  SELECT count(*),coalesce(sum(a.box_count),0),coalesce(sum(a.point_count),0) INTO images,boxes,points
    FROM lab_eggannotationexportitem item JOIN lab_eggannotation a ON a.id=item.annotation_id
    WHERE item.export_id=NEW.export_id;
  IF images>5000 OR (NEW.status='ready' AND (
    NEW.image_count<>images OR NEW.box_count<>boxes OR NEW.point_count<>points
    OR NEW.sha256 !~ '^[0-9a-f]{64}$' OR NEW.object_key !~ '^dataset/[0-9a-f]{32}\.zip$'
  )) THEN RAISE EXCEPTION 'Invalid annotation export result' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END; $$;
"""

# One DO block is one statement: atomic and lock-bounded when autocommitting, and it never
# issues BEGIN/COMMIT, which would commit an enclosing transaction (tests, outer atomic blocks).
EXPAND_SQL = """
DO $$ BEGIN
  SET LOCAL lock_timeout = '2s';
  ALTER TABLE lab_eggannotationexportstatus DROP CONSTRAINT lab_annotation_export_state;
  ALTER TABLE lab_eggannotationexportstatus ADD CONSTRAINT lab_annotation_export_state
    CHECK (status IN ('queued','running','ready','failed','expired')) NOT VALID;
END $$;
"""

REVERSE_SQL = """
DO $$ BEGIN
  SET LOCAL lock_timeout = '2s';
  ALTER TABLE lab_eggannotationexportstatus DROP CONSTRAINT lab_annotation_export_state;
  ALTER TABLE lab_eggannotationexportstatus ADD CONSTRAINT lab_annotation_export_state
    CHECK (status IN ('queued','running','ready','failed')) NOT VALID;
END $$;
"""


def protect_reverse(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    if apps.get_model("lab", "EggAnnotationExportStatus").objects.filter(status="expired").exists():
        raise IrreversibleError("Retain immutable annotation export expiry facts.")


class Migration(migrations.Migration):
    atomic = False
    dependencies = [("lab", "0018_egg_annotation_export_guards")]
    operations = [
        migrations.RunSQL(
            migrations.RunSQL.noop,
            "ALTER TABLE lab_eggannotationexportstatus VALIDATE CONSTRAINT lab_annotation_export_state;",
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunSQL(EXPAND_SQL, REVERSE_SQL)],
            state_operations=[
                migrations.AlterField(
                    model_name="eggannotationexportstatus",
                    name="status",
                    field=models.CharField(
                        max_length=7,
                        choices=[
                            (value, value)
                            for value in ("queued", "running", "ready", "failed", "expired")
                        ],
                    ),
                ),
                migrations.RemoveConstraint(
                    model_name="eggannotationexportstatus", name="lab_annotation_export_state"
                ),
                migrations.AddConstraint(
                    model_name="eggannotationexportstatus",
                    constraint=models.CheckConstraint(
                        condition=models.Q(
                            status__in=["queued", "running", "ready", "failed", "expired"]
                        ),
                        name="lab_annotation_export_state",
                    ),
                ),
            ],
        ),
        migrations.RunSQL(
            "ALTER TABLE lab_eggannotationexportstatus VALIDATE CONSTRAINT lab_annotation_export_state;",
            migrations.RunSQL.noop,
        ),
        # The expanded guard also accepts every old transition; the old CHECK still denies expiry after downgrade.
        migrations.RunSQL(FORWARD_SQL, migrations.RunSQL.noop),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
