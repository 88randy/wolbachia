"""Keep external delivery and its exact signed debit in the existing ledger."""

from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.exceptions import IrreversibleError
from django.db.migrations.state import StateApps

FORWARD = """
CREATE FUNCTION inventory_material_delivery_operation_guard() RETURNS trigger AS $$
BEGIN
 IF NEW.material_delivery_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM lab_deliveryreceipt receipt JOIN lab_materialrequest request ON request.id=receipt.request_id
   WHERE receipt.id=NEW.material_delivery_id AND receipt.organization_id=NEW.organization_id
     AND request.organization_id=NEW.organization_id AND receipt.created_by_id=NEW.created_by_id
     AND NEW.source_kind='material_delivery' AND NEW.source_id=receipt.id
     AND NEW.content_hash=receipt.input_hash
 ) THEN RAISE EXCEPTION 'Material delivery operation requires its exact receipt'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER inventory_material_delivery_operation_guard BEFORE INSERT ON inventory_stockoperation
FOR EACH ROW EXECUTE FUNCTION inventory_material_delivery_operation_guard();

CREATE FUNCTION inventory_material_delivery_complete() RETURNS trigger AS $$
DECLARE receipt lab_deliveryreceipt; request lab_materialrequest; operation inventory_stockoperation;
BEGIN
 IF TG_TABLE_NAME='lab_deliveryreceipt' THEN
   receipt=NEW;
 ELSIF TG_TABLE_NAME='inventory_stockoperation' THEN
   IF NEW.material_delivery_id IS NULL THEN RETURN NEW; END IF;
   SELECT * INTO receipt FROM lab_deliveryreceipt WHERE id=NEW.material_delivery_id;
 ELSE
   SELECT * INTO operation FROM inventory_stockoperation WHERE id=NEW.operation_id;
   IF operation.material_delivery_id IS NULL THEN RETURN NEW; END IF;
   SELECT * INTO receipt FROM lab_deliveryreceipt WHERE id=operation.material_delivery_id;
 END IF;
 SELECT * INTO request FROM lab_materialrequest WHERE id=receipt.request_id;
 SELECT * INTO operation FROM inventory_stockoperation WHERE material_delivery_id=receipt.id;
 IF request.id IS NULL OR operation.id IS NULL OR request.quantity<=0
   OR request.organization_id IS DISTINCT FROM receipt.organization_id
   OR operation.organization_id IS DISTINCT FROM receipt.organization_id
   OR operation.created_by_id IS DISTINCT FROM receipt.created_by_id
   OR operation.source_kind IS DISTINCT FROM 'material_delivery'
   OR operation.source_id IS DISTINCT FROM receipt.id
   OR operation.content_hash IS DISTINCT FROM receipt.input_hash
   OR (SELECT count(*) FROM inventory_stockmovement WHERE operation_id=operation.id)<>1
   OR NOT EXISTS (
     SELECT 1 FROM inventory_stockmovement debit WHERE debit.operation_id=operation.id
       AND debit.organization_id=receipt.organization_id AND debit.created_by_id=receipt.created_by_id
       AND debit.lot_id=request.lot_id AND debit.location_id=request.location_id
       AND debit.piece_id IS NOT DISTINCT FROM request.piece_id
       AND debit.unit_version_id=request.unit_version_id AND debit.assignment_id IS NULL
       AND debit.quantity=-request.quantity AND debit.line_number=1
   ) THEN RAISE EXCEPTION 'Material delivery must commit exactly one matching signed debit'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER inventory_material_delivery_complete AFTER INSERT ON lab_deliveryreceipt
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_material_delivery_complete();
CREATE CONSTRAINT TRIGGER inventory_material_delivery_operation_complete AFTER INSERT ON inventory_stockoperation
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_material_delivery_complete();
CREATE CONSTRAINT TRIGGER inventory_material_delivery_movement_complete AFTER INSERT ON inventory_stockmovement
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_material_delivery_complete();
"""

REVERSE = """
DROP TRIGGER inventory_material_delivery_movement_complete ON inventory_stockmovement;
DROP TRIGGER inventory_material_delivery_operation_complete ON inventory_stockoperation;
DROP TRIGGER inventory_material_delivery_complete ON lab_deliveryreceipt;
DROP TRIGGER inventory_material_delivery_operation_guard ON inventory_stockoperation;
DROP FUNCTION inventory_material_delivery_complete();
DROP FUNCTION inventory_material_delivery_operation_guard();
"""


def protect_reverse(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    if apps.get_model("lab", "DeliveryReceipt").objects.exists():
        raise IrreversibleError("Retain external delivery receipts and signed material movements.")


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0011_shipments"),
        ("lab", "0006_shipments"),
    ]
    operations = [
        migrations.RunSQL(FORWARD, REVERSE),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
