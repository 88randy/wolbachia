"""Compare UUID identities without rewriting immutable source payloads or their hashes."""

from importlib import import_module

from django.db import migrations

PRIOR = import_module("releases.migrations.0002_release_guards")
PRIOR_FUNCTION = PRIOR.SOURCE_SQL.split("CREATE CONSTRAINT TRIGGER", 1)[0].replace(
    "CREATE FUNCTION releases_source_validate()",
    "CREATE OR REPLACE FUNCTION releases_source_validate()",
    1,
)

UUID_HELPER_SQL = """
CREATE FUNCTION releases_source_uuid(value text) RETURNS uuid AS $$
DECLARE normalized text;
BEGIN
 normalized := replace(btrim(replace(replace(value,'urn:',''),'uuid:',''),'{}'),'-','');
 IF normalized !~ '^[0-9a-fA-F]{32}$'
 THEN RAISE EXCEPTION 'invalid release UUID declaration'; END IF;
 RETURN normalized::uuid;
END; $$ LANGUAGE plpgsql IMMUTABLE STRICT;
"""

SOURCE_FUNCTION = PRIOR_FUNCTION
RELATIONS = {
    "permit_id": "v.permit_id",
    "release_device_id": "NEW.release_device_id",
    "lot_id": "NEW.lot_id",
    "training_version": "NEW.training_version_id",
    "schedule_task_id": "NEW.schedule_task_id",
}
for key, target in RELATIONS.items():
    previous = f"e.payload->>'{key}'={target}::text"
    if SOURCE_FUNCTION.count(previous) != 1:
        raise ValueError("The canonical release source UUID boundary changed.")
    SOURCE_FUNCTION = SOURCE_FUNCTION.replace(
        previous,
        f"jsonb_typeof(e.payload->'{key}')='string' "
        f"AND releases_source_uuid(e.payload->>'{key}')={target}",
        1,
    )

FORWARD_SQL = UUID_HELPER_SQL + SOURCE_FUNCTION
REVERSE_SQL = PRIOR_FUNCTION + "\nDROP FUNCTION releases_source_uuid(text);\n"


class Migration(migrations.Migration):
    dependencies = [("releases", "0004_release_device_status_guard")]
    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
        migrations.RunPython(migrations.RunPython.noop, PRIOR.refuse_populated_reverse),
    ]
