"""One typed recovery credits consumed stock; positive custody retains its prior receipt."""

from importlib import import_module

from django.apps.registry import Apps
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.exceptions import IrreversibleError

PRIOR = import_module("inventory.migrations.0006_courier_supply_guards")
OLD_DISPOSAL = PRIOR.CHECKS["bagdisposition"]
NEW_DISPOSAL = (
    OLD_DISPOSAL.replace(
        "AND member.selected=false",
        "AND (NOT member.selected OR EXISTS(SELECT 1 FROM lab_recountrequest q WHERE q.count_id=count.id AND lab_qa_resolution_current(q.id,result.id)))",
    )
    .replace(
        "NEW.dependency_proof->'selected'='false'::jsonb",
        "NEW.dependency_proof->'selected'=to_jsonb(member.selected)",
    )
    .replace(
        "WHERE superseded.request_id=request.id))",
        "WHERE superseded.request_id=request.id) AND NOT lab_qa_resolution_current(request.id,result.id))",
    )
)
if NEW_DISPOSAL == OLD_DISPOSAL or "AND member.selected=false" in NEW_DISPOSAL:
    raise ValueError("The canonical disposal extension boundary changed")


def disposal_function(condition: str) -> str:
    template = """CREATE OR REPLACE FUNCTION inventory_bagdisposition_supply_guard() RETURNS trigger AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'supply facts are insert-only'; END IF;
 IF NEW.created_by_id IS NULL OR NOT COALESCE((__CANONICAL_CONDITION__),false)
   OR EXISTS(SELECT 1 FROM lab_paddlereuse reused JOIN lab_paddlebagbinding binding ON binding.id=reused.binding_id WHERE binding.bag_id=NEW.bag_id)
   THEN RAISE EXCEPTION 'supply identity, provenance or organization mismatch'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
"""
    return template.replace("__CANONICAL_CONDITION__", condition)


GUARDS = r"""
CREATE FUNCTION inventory_paddle_return_guard() RETURNS trigger AS $$
DECLARE reused lab_paddlereuse; binding lab_paddlebagbinding; registered lab_eggpaddle;
        source inventory_stockmovement; original inventory_stockmovement;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Paddle recovery facts are insert-only'; END IF;
 PERFORM 1 FROM organizations_organization WHERE id=NEW.organization_id FOR NO KEY UPDATE NOWAIT;
 SELECT * INTO reused FROM lab_paddlereuse WHERE id=NEW.reuse_id;
 SELECT * INTO binding FROM lab_paddlebagbinding WHERE id=reused.binding_id;
 SELECT * INTO registered FROM lab_eggpaddle WHERE id=binding.paddle_id;
 SELECT * INTO source FROM inventory_stockmovement WHERE id=NEW.source_movement_id;
 SELECT * INTO original FROM inventory_stockmovement WHERE id=binding.issue_movement_id;
 IF reused.id IS NULL OR reused.organization_id IS DISTINCT FROM NEW.organization_id OR reused.created_by_id IS DISTINCT FROM NEW.created_by_id
   OR source.organization_id IS DISTINCT FROM NEW.organization_id OR NEW.source_movement_id IS DISTINCT FROM reused.source_movement_id
   OR NEW.destination_id IS DISTINCT FROM reused.destination_id OR NEW.piece_id IS DISTINCT FROM registered.piece_id
   OR source.piece_id IS DISTINCT FROM NEW.piece_id OR original.piece_id IS DISTINCT FROM NEW.piece_id
   OR source.lot_id IS DISTINCT FROM NEW.lot_id OR original.lot_id IS DISTINCT FROM NEW.lot_id
   OR source.unit_version_id IS DISTINCT FROM NEW.unit_version_id OR original.unit_version_id IS DISTINCT FROM NEW.unit_version_id
   OR NEW.content_hash !~ '^[0-9a-f]{64}$' OR NOT EXISTS(SELECT 1 FROM inventory_location WHERE id=NEW.destination_id AND organization_id=NEW.organization_id)
   THEN RAISE EXCEPTION 'Paddle return requires its exact real Piece, unit, cycle and authored reuse'; END IF;
 IF NEW.kind='consumed' THEN
   IF source.quantity<>-1 OR source.assignment_id IS NULL OR NEW.consumed_debit_id IS DISTINCT FROM source.id OR NEW.source_location_id IS NOT NULL
     OR NOT COALESCE(lab_paddle_issue_valid(source.id,binding.bag_id),false)
     OR NOT EXISTS(SELECT 1 FROM inventory_supplystockeffect used JOIN inventory_supplystockeffect issued ON issued.movement_id=original.id
       WHERE used.movement_id=source.id AND used.kind='used' AND used.receipt_line_id=issued.receipt_line_id)
     THEN RAISE EXCEPTION 'Recovery requires the exact genuine consumed debit, never an invented return'; END IF;
 ELSIF NEW.kind='custody' THEN
   IF source.quantity<>1 OR NEW.consumed_debit_id IS NOT NULL OR source.location_id IS DISTINCT FROM NEW.source_location_id
     OR source.location_id IS DISTINCT FROM NEW.destination_id OR NOT EXISTS(
       SELECT 1 FROM inventory_supplystockeffect credited JOIN inventory_supplystockeffect issued ON issued.movement_id=original.id
       JOIN inventory_supplyledgersource ledger ON ledger.id=credited.source_id
       JOIN inventory_returnacceptance accepted ON accepted.execution_id=ledger.execution_id
       JOIN inventory_returndeclaration declaration ON declaration.id=accepted.declaration_id
       WHERE credited.movement_id=source.id AND credited.kind='return_credit' AND issued.kind='courier_credit'
       AND ledger.kind='supply_return' AND credited.receipt_line_id=issued.receipt_line_id
       AND declaration.receipt_line_id=issued.receipt_line_id AND accepted.quantity=1)
     OR (SELECT COALESCE(SUM(quantity),0) FROM inventory_stockmovement WHERE organization_id=NEW.organization_id
       AND piece_id=NEW.piece_id AND unit_version_id=NEW.unit_version_id AND location_id=NEW.source_location_id)<>1
     THEN RAISE EXCEPTION 'Positive custody must retain its actual canonical return_accept credit'; END IF;
 ELSE RAISE EXCEPTION 'Unknown paddle recovery branch';
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER inventory_paddlestockreturn_guard BEFORE INSERT OR UPDATE OR DELETE ON inventory_paddlestockreturn
FOR EACH ROW EXECUTE FUNCTION inventory_paddle_return_guard();

CREATE FUNCTION inventory_paddle_operation_guard() RETURNS trigger AS $$
BEGIN
 IF NEW.paddle_return_id IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM inventory_paddlestockreturn returned WHERE returned.id=NEW.paddle_return_id
     AND returned.kind='consumed' AND returned.organization_id=NEW.organization_id AND returned.created_by_id=NEW.created_by_id
     AND NEW.source_kind='paddle_return' AND NEW.source_id=returned.id AND NEW.content_hash=returned.content_hash)
     THEN RAISE EXCEPTION 'Paddle stock operation requires its exact typed consumed recovery'; END IF;
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER inventory_paddle_operation_guard BEFORE INSERT ON inventory_stockoperation
FOR EACH ROW EXECUTE FUNCTION inventory_paddle_operation_guard();

CREATE FUNCTION inventory_paddle_return_complete() RETURNS trigger AS $$
DECLARE returned inventory_paddlestockreturn; operation inventory_stockoperation; total numeric;
BEGIN
 IF TG_TABLE_NAME='inventory_paddlestockreturn' THEN
   returned=NEW;
 ELSIF TG_TABLE_NAME='inventory_stockoperation' THEN
   IF NEW.paddle_return_id IS NULL THEN RETURN NEW; END IF;
   SELECT * INTO returned FROM inventory_paddlestockreturn WHERE id=NEW.paddle_return_id;
 ELSE
   SELECT * INTO operation FROM inventory_stockoperation WHERE id=NEW.operation_id;
   IF operation.paddle_return_id IS NULL THEN RETURN NEW; END IF;
   SELECT * INTO returned FROM inventory_paddlestockreturn WHERE id=operation.paddle_return_id;
 END IF;
 IF returned.kind='consumed' THEN
   SELECT * INTO operation FROM inventory_stockoperation WHERE paddle_return_id=returned.id;
   IF operation.id IS NULL OR (SELECT count(*) FROM inventory_stockmovement WHERE operation_id=operation.id)<>1
     OR NOT EXISTS(SELECT 1 FROM inventory_stockmovement credit WHERE credit.operation_id=operation.id
       AND credit.quantity=1 AND credit.piece_id=returned.piece_id AND credit.lot_id=returned.lot_id
       AND credit.unit_version_id=returned.unit_version_id AND credit.location_id=returned.destination_id
       AND credit.assignment_id IS NULL AND credit.created_by_id=returned.created_by_id AND credit.organization_id=returned.organization_id)
     THEN RAISE EXCEPTION 'Consumed paddle recovery must commit exactly one same-Piece credit'; END IF;
 ELSE
   IF EXISTS(SELECT 1 FROM inventory_stockoperation WHERE paddle_return_id=returned.id)
     THEN RAISE EXCEPTION 'Treatment cannot credit positive returned custody twice'; END IF;
 END IF;
 SELECT COALESCE(SUM(quantity),0) INTO total FROM inventory_stockmovement WHERE organization_id=returned.organization_id AND piece_id=returned.piece_id;
 IF total<>1 THEN RAISE EXCEPTION 'A reusable physical Piece must have exactly one actual unit'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER inventory_paddle_return_complete AFTER INSERT ON inventory_paddlestockreturn
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_paddle_return_complete();
CREATE CONSTRAINT TRIGGER inventory_paddle_operation_complete AFTER INSERT ON inventory_stockoperation
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_paddle_return_complete();
CREATE CONSTRAINT TRIGGER inventory_paddle_movement_complete AFTER INSERT ON inventory_stockmovement
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_paddle_return_complete();
"""

FORWARD = disposal_function(NEW_DISPOSAL) + GUARDS
REVERSE = """
DROP TRIGGER inventory_paddle_movement_complete ON inventory_stockmovement;
DROP TRIGGER inventory_paddle_operation_complete ON inventory_stockoperation;
DROP TRIGGER inventory_paddle_return_complete ON inventory_paddlestockreturn;
DROP TRIGGER inventory_paddle_operation_guard ON inventory_stockoperation;
DROP TRIGGER inventory_paddlestockreturn_guard ON inventory_paddlestockreturn;
DROP FUNCTION inventory_paddle_return_complete(); DROP FUNCTION inventory_paddle_operation_guard(); DROP FUNCTION inventory_paddle_return_guard();
"""
# Restore the exact prior function body, including its unchanged exception semantics.
OLD_FUNCTION = PRIOR.INSERT_ONLY.split(
    "CREATE FUNCTION inventory_bagdisposition_supply_guard()", 1
)[1].split("CREATE TRIGGER inventory_bagdisposition_guard", 1)[0]
REVERSE += "CREATE OR REPLACE FUNCTION inventory_bagdisposition_supply_guard()" + OLD_FUNCTION


def protect_reverse(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    if apps.get_model("inventory", "PaddleStockReturn").objects.exists():
        raise IrreversibleError(
            "Retain real consumed-debit recovery and prior positive-custody receipts."
        )


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0008_independent_qa_and_paddles"),
        ("lab", "0005_independent_qa_guards"),
    ]
    operations = [
        migrations.RunSQL(FORWARD, REVERSE),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
