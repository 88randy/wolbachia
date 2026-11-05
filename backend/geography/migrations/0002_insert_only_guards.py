"""Preserve fixed identities, evidence and published geometry even through raw SQL."""

from django.db import migrations

FORWARD_SQL = """
CREATE FUNCTION geography_insert_only_guard() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'geography identities and versions are insert-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER geography_quadrant_guard BEFORE UPDATE OR DELETE ON geography_quadrant FOR EACH ROW EXECUTE FUNCTION geography_insert_only_guard();
CREATE TRIGGER geography_quadrantversion_guard BEFORE UPDATE OR DELETE ON geography_quadrantversion FOR EACH ROW EXECUTE FUNCTION geography_insert_only_guard();
CREATE TRIGGER geography_block_guard BEFORE UPDATE OR DELETE ON geography_block FOR EACH ROW EXECUTE FUNCTION geography_insert_only_guard();
CREATE TRIGGER geography_blockversion_guard BEFORE UPDATE OR DELETE ON geography_blockversion FOR EACH ROW EXECUTE FUNCTION geography_insert_only_guard();
CREATE TRIGGER geography_samplingpoint_guard BEFORE UPDATE OR DELETE ON geography_samplingpoint FOR EACH ROW EXECUTE FUNCTION geography_insert_only_guard();
CREATE TRIGGER geography_pointversion_guard BEFORE UPDATE OR DELETE ON geography_pointversion FOR EACH ROW EXECUTE FUNCTION geography_insert_only_guard();
CREATE TRIGGER geography_excludedpointresolution_guard BEFORE UPDATE OR DELETE ON geography_excludedpointresolution FOR EACH ROW EXECUTE FUNCTION geography_insert_only_guard();
"""
REVERSE_SQL = """
DROP TRIGGER geography_quadrant_guard ON geography_quadrant;
DROP TRIGGER geography_quadrantversion_guard ON geography_quadrantversion;
DROP TRIGGER geography_block_guard ON geography_block;
DROP TRIGGER geography_blockversion_guard ON geography_blockversion;
DROP TRIGGER geography_samplingpoint_guard ON geography_samplingpoint;
DROP TRIGGER geography_pointversion_guard ON geography_pointversion;
DROP TRIGGER geography_excludedpointresolution_guard ON geography_excludedpointresolution;
DROP FUNCTION geography_insert_only_guard();
"""


class Migration(migrations.Migration):
    dependencies = [("geography", "0001_initial")]
    operations = [migrations.RunSQL(FORWARD_SQL, REVERSE_SQL)]
