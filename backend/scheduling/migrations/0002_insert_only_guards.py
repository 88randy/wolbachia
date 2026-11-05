"""Reject raw updates and physical deletes of every planning fact."""
from django.db import migrations

FORWARD_SQL = """CREATE FUNCTION scheduling_insert_only_guard() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'scheduling records are insert-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER scheduling_riskimportupload_guard BEFORE UPDATE OR DELETE ON scheduling_riskimportupload FOR EACH ROW EXECUTE FUNCTION scheduling_insert_only_guard();
CREATE TRIGGER scheduling_riskimport_guard BEFORE UPDATE OR DELETE ON scheduling_riskimport FOR EACH ROW EXECUTE FUNCTION scheduling_insert_only_guard();
CREATE TRIGGER scheduling_riskimportapplication_guard BEFORE UPDATE OR DELETE ON scheduling_riskimportapplication FOR EACH ROW EXECUTE FUNCTION scheduling_insert_only_guard();
CREATE TRIGGER scheduling_riskcategoryversion_guard BEFORE UPDATE OR DELETE ON scheduling_riskcategoryversion FOR EACH ROW EXECUTE FUNCTION scheduling_insert_only_guard();
CREATE TRIGGER scheduling_assignmentversion_guard BEFORE UPDATE OR DELETE ON scheduling_assignmentversion FOR EACH ROW EXECUTE FUNCTION scheduling_insert_only_guard();
CREATE TRIGGER scheduling_scheduledtask_guard BEFORE UPDATE OR DELETE ON scheduling_scheduledtask FOR EACH ROW EXECUTE FUNCTION scheduling_insert_only_guard();
CREATE TRIGGER scheduling_taskownership_guard BEFORE UPDATE OR DELETE ON scheduling_taskownership FOR EACH ROW EXECUTE FUNCTION scheduling_insert_only_guard();
CREATE TRIGGER scheduling_schedulerevision_guard BEFORE UPDATE OR DELETE ON scheduling_schedulerevision FOR EACH ROW EXECUTE FUNCTION scheduling_insert_only_guard();"""
REVERSE_SQL = """DROP TRIGGER scheduling_riskimportupload_guard ON scheduling_riskimportupload;
DROP TRIGGER scheduling_riskimport_guard ON scheduling_riskimport;
DROP TRIGGER scheduling_riskimportapplication_guard ON scheduling_riskimportapplication;
DROP TRIGGER scheduling_riskcategoryversion_guard ON scheduling_riskcategoryversion;
DROP TRIGGER scheduling_assignmentversion_guard ON scheduling_assignmentversion;
DROP TRIGGER scheduling_scheduledtask_guard ON scheduling_scheduledtask;
DROP TRIGGER scheduling_taskownership_guard ON scheduling_taskownership;
DROP TRIGGER scheduling_schedulerevision_guard ON scheduling_schedulerevision;
DROP FUNCTION scheduling_insert_only_guard();"""


class Migration(migrations.Migration):
    dependencies = [("scheduling", "0001_initial")]
    operations = [migrations.RunSQL(FORWARD_SQL, REVERSE_SQL)]
