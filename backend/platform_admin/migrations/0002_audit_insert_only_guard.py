"""Platform audit receipts cannot be rewritten or deleted, not even with raw SQL."""

from django.db import migrations

FORWARD_SQL = """
CREATE FUNCTION platform_audit_insert_only_guard() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'platform audit entries are insert-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER platform_admin_platformauditentry_guard BEFORE UPDATE OR DELETE
ON platform_admin_platformauditentry FOR EACH ROW
EXECUTE FUNCTION platform_audit_insert_only_guard();
"""
REVERSE_SQL = """
DROP TRIGGER platform_admin_platformauditentry_guard ON platform_admin_platformauditentry;
DROP FUNCTION platform_audit_insert_only_guard();
"""


class Migration(migrations.Migration):
    dependencies = [("platform_admin", "0001_initial")]
    operations = [migrations.RunSQL(FORWARD_SQL, REVERSE_SQL)]
