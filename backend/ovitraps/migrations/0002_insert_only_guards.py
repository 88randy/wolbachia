"""Keep original placements, readings, bags and lifecycle decisions immutable."""
from django.db import migrations

FORWARD_SQL = """CREATE FUNCTION ovitrap_insert_only_guard() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'ovitrap records are insert-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER ovitraps_ovitrap_guard BEFORE UPDATE OR DELETE ON ovitraps_ovitrap FOR EACH ROW EXECUTE FUNCTION ovitrap_insert_only_guard();
CREATE TRIGGER ovitraps_placementattempt_guard BEFORE UPDATE OR DELETE ON ovitraps_placementattempt FOR EACH ROW EXECUTE FUNCTION ovitrap_insert_only_guard();
CREATE TRIGGER ovitraps_ovitrapreading_guard BEFORE UPDATE OR DELETE ON ovitraps_ovitrapreading FOR EACH ROW EXECUTE FUNCTION ovitrap_insert_only_guard();
CREATE TRIGGER ovitraps_bag_guard BEFORE UPDATE OR DELETE ON ovitraps_bag FOR EACH ROW EXECUTE FUNCTION ovitrap_insert_only_guard();
CREATE TRIGGER ovitraps_ovitrapvoid_guard BEFORE UPDATE OR DELETE ON ovitraps_ovitrapvoid FOR EACH ROW EXECUTE FUNCTION ovitrap_insert_only_guard();"""
REVERSE_SQL = """DROP TRIGGER ovitraps_ovitrap_guard ON ovitraps_ovitrap;
DROP TRIGGER ovitraps_placementattempt_guard ON ovitraps_placementattempt;
DROP TRIGGER ovitraps_ovitrapreading_guard ON ovitraps_ovitrapreading;
DROP TRIGGER ovitraps_bag_guard ON ovitraps_bag;
DROP TRIGGER ovitraps_ovitrapvoid_guard ON ovitraps_ovitrapvoid;
DROP FUNCTION ovitrap_insert_only_guard();"""


class Migration(migrations.Migration):
    dependencies = [("ovitraps", "0001_initial")]
    operations = [migrations.RunSQL(FORWARD_SQL, REVERSE_SQL)]
