"""Retain immutable transfer facts and enforce their real tenant/pair ownership."""

from django.db import migrations
from django.db.migrations.exceptions import IrreversibleError

TABLES = ("privacy_datatransferauthorization", "privacy_datatransferrevocation")

FORWARD = """
CREATE FUNCTION privacy_transfer_fact_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'Transfer facts are insert-only' USING ERRCODE='23514';
    END IF;
    IF NEW.created_by_id IS NULL THEN
        RAISE EXCEPTION 'Transfer facts require a human author' USING ERRCODE='23514';
    END IF;
    IF TG_TABLE_NAME='privacy_datatransferauthorization' THEN
        IF NOT EXISTS(SELECT 1 FROM organizations_center c
            WHERE c.id=NEW.center_id AND c.organization_id=NEW.organization_id)
          OR (NEW.quadrant_id IS NOT NULL AND NOT EXISTS(
            SELECT 1 FROM geography_quadrant q WHERE q.id=NEW.quadrant_id
              AND q.organization_id=NEW.organization_id AND q.center_id=NEW.center_id))
          OR length(btrim(NEW.reference))=0 OR length(btrim(NEW.recipient_institution))=0
        THEN RAISE EXCEPTION 'Transfer authorization parent invalid' USING ERRCODE='23514'; END IF;
    ELSE
        IF NOT EXISTS(SELECT 1 FROM privacy_datatransferauthorization a
            WHERE a.id=NEW.authorization_id AND a.organization_id=NEW.organization_id)
          OR length(NEW.reason)>1000 OR length(regexp_replace(NEW.reason, '[[:space:]]', '', 'g'))<10
        THEN RAISE EXCEPTION 'Transfer withdrawal parent/reason invalid' USING ERRCODE='23514'; END IF;
    END IF;
    RETURN NEW;
END; $$;
""" + "\n".join(
    f"CREATE TRIGGER {table}_guard BEFORE INSERT OR UPDATE OR DELETE ON {table} "
    "FOR EACH ROW EXECUTE FUNCTION privacy_transfer_fact_guard();"
    for table in TABLES
)

REVERSE = "\n".join(
    f"DROP TRIGGER {table}_guard ON {table};" for table in reversed(TABLES)
) + "\nDROP FUNCTION privacy_transfer_fact_guard();"


def protect_reverse(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        for table in TABLES:
            cursor.execute(f'SELECT EXISTS(SELECT 1 FROM "{table}")')
            if cursor.fetchone()[0]:
                raise IrreversibleError("Retain authored data transfer authorization/withdrawal audit.")


class Migration(migrations.Migration):
    dependencies = [("privacy", "0001_transfer_eligibility")]
    operations = [
        migrations.RunSQL(FORWARD, REVERSE),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
