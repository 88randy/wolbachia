"""Exact delivered snapshot content cannot be rewritten or deleted."""
from django.db import migrations

FORWARD_SQL = """
CREATE FUNCTION catalog_snapshot_insert_only_guard() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'catalog snapshots are insert-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER catalogs_catalogsnapshot_guard BEFORE UPDATE OR DELETE ON catalogs_catalogsnapshot FOR EACH ROW EXECUTE FUNCTION catalog_snapshot_insert_only_guard();
"""
REVERSE_SQL = """
DROP TRIGGER catalogs_catalogsnapshot_guard ON catalogs_catalogsnapshot;
DROP FUNCTION catalog_snapshot_insert_only_guard();
"""


class Migration(migrations.Migration):
    dependencies = [("catalogs", "0004_catalogsnapshot")]
    operations = [migrations.RunSQL(FORWARD_SQL, REVERSE_SQL)]
