from django.db import migrations

FORWARD_SQL = """
CREATE FUNCTION fleet_servicerecord_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL
       AND (to_jsonb(NEW) - ARRAY['voided_at','voided_by_id','void_reason','void_reason_code'])
           = (to_jsonb(OLD) - ARRAY['voided_at','voided_by_id','void_reason','void_reason_code']) THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'fleet history is insert-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER fleet_servicerecord_guard BEFORE UPDATE OR DELETE ON fleet_servicerecord
FOR EACH ROW EXECUTE FUNCTION fleet_servicerecord_guard();
CREATE FUNCTION fleet_responsibilityletter_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL
       AND (to_jsonb(NEW) - ARRAY['voided_at','voided_by_id','void_reason','void_reason_code'])
           = (to_jsonb(OLD) - ARRAY['voided_at','voided_by_id','void_reason','void_reason_code']) THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'fleet history is insert-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER fleet_responsibilityletter_guard BEFORE UPDATE OR DELETE ON fleet_responsibilityletter
FOR EACH ROW EXECUTE FUNCTION fleet_responsibilityletter_guard();
CREATE FUNCTION fleet_fuelload_guard() RETURNS trigger AS $$
BEGIN

    RAISE EXCEPTION 'fleet history is insert-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER fleet_fuelload_guard BEFORE UPDATE OR DELETE ON fleet_fuelload
FOR EACH ROW EXECUTE FUNCTION fleet_fuelload_guard();
CREATE FUNCTION fleet_inspectionclearance_guard() RETURNS trigger AS $$
BEGIN

    RAISE EXCEPTION 'fleet history is insert-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER fleet_inspectionclearance_guard BEFORE UPDATE OR DELETE ON fleet_inspectionclearance
FOR EACH ROW EXECUTE FUNCTION fleet_inspectionclearance_guard();
"""
REVERSE_SQL = """
DROP TRIGGER fleet_inspectionclearance_guard ON fleet_inspectionclearance;
DROP FUNCTION fleet_inspectionclearance_guard();
DROP TRIGGER fleet_fuelload_guard ON fleet_fuelload;
DROP FUNCTION fleet_fuelload_guard();
DROP TRIGGER fleet_responsibilityletter_guard ON fleet_responsibilityletter;
DROP FUNCTION fleet_responsibilityletter_guard();
DROP TRIGGER fleet_servicerecord_guard ON fleet_servicerecord;
DROP FUNCTION fleet_servicerecord_guard();
"""

class Migration(migrations.Migration):
    dependencies = [("fleet", "0001_initial"), ("shifts", "0004_motorcycle_center_motorcycle_revision")]
    operations = [migrations.RunSQL(FORWARD_SQL, REVERSE_SQL)]
