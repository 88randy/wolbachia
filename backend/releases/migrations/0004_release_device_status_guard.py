"""Equipment lifecycle appends under its immutable device identity."""

from django.db import migrations
from django.db.migrations.exceptions import IrreversibleError

FORWARD_SQL = """
CREATE FUNCTION releases_releasedevicestatus_validate() RETURNS trigger AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'release device statuses are insert-only'; END IF;
 PERFORM 1 FROM releases_releasedevice WHERE id=NEW.device_id FOR NO KEY UPDATE;
 IF NEW.created_by_id IS NULL OR NOT EXISTS (
     SELECT 1 FROM releases_releasedevice d WHERE d.id=NEW.device_id
       AND d.organization_id=NEW.organization_id)
   OR NEW.revision<>(SELECT COALESCE(MAX(s.revision),1)+1
       FROM releases_releasedevicestatus s WHERE s.device_id=NEW.device_id)
   OR EXISTS(SELECT 1 FROM releases_releasedevicestatus s WHERE s.device_id=NEW.device_id AND s.status='retired')
   OR length(regexp_replace(NEW.reason,'[[:space:]]','','g'))<10 OR length(NEW.reason)>1000
 THEN RAISE EXCEPTION 'invalid release device status lineage'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER releases_releasedevicestatus_guard BEFORE INSERT OR UPDATE OR DELETE
ON releases_releasedevicestatus FOR EACH ROW EXECUTE FUNCTION releases_releasedevicestatus_validate();
"""
REVERSE_SQL = """
DROP TRIGGER releases_releasedevicestatus_guard ON releases_releasedevicestatus;
DROP FUNCTION releases_releasedevicestatus_validate();
"""


def refuse_populated_reverse(apps, schema_editor):
    model = apps.get_model("releases", "ReleaseDeviceStatus")
    if model.objects.using(schema_editor.connection.alias).exists():
        raise IrreversibleError("Release equipment lifecycle must be retained.")


class Migration(migrations.Migration):
    dependencies = [("releases", "0003_release_device_status")]
    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
        migrations.RunPython(migrations.RunPython.noop, refuse_populated_reverse),
    ]
