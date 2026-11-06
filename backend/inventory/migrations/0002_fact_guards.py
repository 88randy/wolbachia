"""Protect facts even from raw SQL; original migrations remain unchanged."""

from django.db import migrations

TABLES = (
    "supplytype", "supplytypeversion", "biologicalprotocolversion", "location",
    "locationversion", "lot", "lotversion", "lotadmission", "piece", "stockoperation",
    "stockmovement", "conditionreading", "conditionbreach", "conditionincidentlink",
)
FORWARD = """
CREATE FUNCTION inventory_fact_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF TG_TABLE_NAME <> 'inventory_conditionincidentlink' AND NEW.created_by_id IS NULL THEN
            RAISE EXCEPTION 'inventory facts require a human source author';
        END IF;
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'inventory facts are insert-only';
END;
$$ LANGUAGE plpgsql;
""" + "\n".join(
    f"CREATE TRIGGER inventory_{name}_guard BEFORE INSERT OR UPDATE OR DELETE ON inventory_{name} FOR EACH ROW EXECUTE FUNCTION inventory_fact_guard();"
    for name in TABLES
)
REVERSE = "\n".join(f"DROP TRIGGER inventory_{name}_guard ON inventory_{name};" for name in reversed(TABLES)) + "\nDROP FUNCTION inventory_fact_guard();"


class Migration(migrations.Migration):
    dependencies = [("inventory", "0001_initial")]
    operations = [migrations.RunSQL(FORWARD, REVERSE)]
