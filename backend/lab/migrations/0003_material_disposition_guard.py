"""Keep the physical Bag unavailable while allowing only proved historical correction."""

from importlib import import_module

from django.db import migrations
from django.db.migrations.exceptions import IrreversibleError

PRIOR = import_module("lab.migrations.0002_append_only_guards")
SOURCE_START = "CREATE FUNCTION lab_source_void_guard()"
SOURCE_END = "CREATE CONSTRAINT TRIGGER lab_source_void_guard"
OLD_SOURCE = PRIOR.FUNCTIONS.split(SOURCE_START, 1)[1].split(SOURCE_END, 1)[0]
OLD_SOURCE = SOURCE_START + OLD_SOURCE
OLD_TEST = "current.count_id IS NOT NULL OR current.rejection_id IS NOT NULL"
assert OLD_SOURCE.count(OLD_TEST) == 1
NEW_SOURCE = OLD_SOURCE.replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION", 1).replace(
    OLD_TEST,
    OLD_TEST
    + " OR EXISTS(SELECT 1 FROM inventory_bagdisposition disposed WHERE disposed.bag_id=b.id)",
)
SOURCE_HEAD = "IF OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL AND EXISTS("
SOURCE_ERROR = "THEN RAISE EXCEPTION 'Source void must preserve active Lab dependents'"
assert NEW_SOURCE.count(SOURCE_HEAD) == NEW_SOURCE.count(SOURCE_ERROR) == 1
NEW_SOURCE = NEW_SOURCE.replace(SOURCE_HEAD, SOURCE_HEAD.replace("AND EXISTS(", "AND (EXISTS("))
NEW_SOURCE = NEW_SOURCE.replace(
    SOURCE_ERROR,
    "OR EXISTS(SELECT 1 FROM inventory_supplyuse used WHERE used.work_source_id=NEW.id "
    "AND NOT EXISTS(SELECT 1 FROM inventory_supplyvoidaudit audit WHERE audit.event_id=used.event_id))) "
    + SOURCE_ERROR,
)

MATERIAL = """
CREATE FUNCTION lab_physical_material_guard() RETURNS trigger AS $$
BEGIN
    IF EXISTS(SELECT 1 FROM inventory_bagdisposition d WHERE d.bag_id=NEW.bag_id) THEN
      IF NOT COALESCE(EXISTS(
        SELECT 1 FROM lab_labcommand command
        JOIN lab_eggcountattempt predecessor ON predecessor.id=NEW.replacement_of_id
        JOIN lab_labcommand original ON original.id=predecessor.command_id
        JOIN ovitraps_bag bag ON bag.id=NEW.bag_id
        JOIN lab_bagreceipt receipt ON receipt.id=NEW.receipt_id
        JOIN inventory_bagdisposition disposed ON disposed.bag_id=bag.id
        WHERE command.id=NEW.command_id AND command.organization_id=NEW.organization_id
        AND command.action='void_count' AND command.target_id=predecessor.id
        AND jsonb_typeof(command.canonical_input->'replacement')='object'
        AND (command.canonical_input->'replacement'->>'kind')='count'
        AND (command.canonical_input->'replacement'->>'measurement_kind')='data_correction'
        AND NEW.source_proof->>'measurement_kind'='data_correction'
        AND NEW.source_proof->>'measurement_origin_id'=predecessor.id::text
        AND NEW.source_proof->>'measurement_command_id'=original.id::text
        AND predecessor.organization_id=NEW.organization_id AND original.organization_id=NEW.organization_id
        AND predecessor.bag_id=bag.id AND predecessor.receipt_id=receipt.id
        AND predecessor.method_version_id IS NOT DISTINCT FROM NEW.method_version_id
        AND predecessor.source_proof->>'reading_id'=bag.reading_id::text
        AND predecessor.source_proof->>'source_event_id'=disposed.source_event_id::text
        AND receipt.bag_id=bag.id AND receipt.reading_id=bag.reading_id
        AND NEW.source_proof->>'reading_id'=bag.reading_id::text
        AND NEW.source_proof->>'source_event_id'=disposed.source_event_id::text
        AND EXISTS(SELECT 1 FROM lab_labresultrevision r WHERE r.bag_id=bag.id
          AND r.count_id=predecessor.id AND r.revision=(SELECT MAX(v.revision)
            FROM lab_labresultrevision v WHERE v.bag_id=bag.id))
      ),false) THEN
        RAISE EXCEPTION 'Disposed Bag permits only proved historical correction';
      END IF;
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER lab_physical_material_guard BEFORE INSERT ON lab_eggcountattempt
FOR EACH ROW EXECUTE FUNCTION lab_physical_material_guard();

CREATE FUNCTION lab_rejection_material_guard() RETURNS trigger AS $$
BEGIN
    IF EXISTS(SELECT 1 FROM inventory_bagdisposition d WHERE d.bag_id=NEW.bag_id) THEN
      RAISE EXCEPTION 'New Lab rejection requires actual physical material';
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER lab_rejection_material_guard BEFORE INSERT ON lab_labrejection
FOR EACH ROW EXECUTE FUNCTION lab_rejection_material_guard();
"""


def protect_reverse(apps, schema_editor):
    if apps.get_model("inventory", "BagDisposition").objects.exists():
        raise IrreversibleError("Retain the actual physical disposition and count source binding.")


class Migration(migrations.Migration):
    dependencies = [
        ("lab", "0002_append_only_guards"),
        ("inventory", "0005_courier_supplies"),
    ]
    operations = [
        migrations.RunSQL(
            NEW_SOURCE + MATERIAL,
            "DROP TRIGGER lab_physical_material_guard ON lab_eggcountattempt; "
            "DROP FUNCTION lab_physical_material_guard(); "
            "DROP TRIGGER lab_rejection_material_guard ON lab_labrejection; "
            "DROP FUNCTION lab_rejection_material_guard(); "
            + OLD_SOURCE.replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION", 1),
        ),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
