"""A genuine release source debits the existing signed courier-custody ledger."""

from importlib import import_module

import django.db.models.deletion
from django.apps.registry import Apps
from django.db import migrations, models
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.exceptions import IrreversibleError

PRIOR = import_module("inventory.migrations.0006_courier_supply_guards")
SCHEMA = import_module("inventory.migrations.0008_independent_qa_and_paddles")
PREVIOUS_CONSTRAINT = next(
    operation.constraint
    for operation in SCHEMA.Migration.operations
    if isinstance(operation, migrations.AddConstraint) and operation.model_name == "stockoperation"
)
SOURCE_CONDITION = models.Q(
    *[
        models.Q(**dict(branch.children), release__isnull=True, release_receipt_line__isnull=True)
        for branch in PREVIOUS_CONSTRAINT.condition.children
    ],
    models.Q(
        source_kind="release_record",
        admission__isnull=True,
        transfer_event__isnull=True,
        supply_source__isnull=True,
        paddle_return__isnull=True,
        release__isnull=False,
        release_receipt_line__isnull=False,
    ),
    _connector="OR",
)

OLD_MOVEMENT = (
    "CREATE OR REPLACE FUNCTION inventory_supply_movement_complete()"
    + PRIOR.BALANCE.split("CREATE FUNCTION inventory_supply_movement_complete()", 1)[1].split(
        "CREATE CONSTRAINT TRIGGER inventory_supply_movement_complete", 1
    )[0]
)
NEW_MOVEMENT = OLD_MOVEMENT.replace(
    "IF operation.supply_source_id IS NULL OR NOT EXISTS",
    "IF (operation.supply_source_id IS NULL AND operation.release_id IS NULL) OR NOT EXISTS",
)
OLD_REMAINING = (
    "CREATE OR REPLACE FUNCTION inventory_supply_receipt_remaining(receipt_uuid uuid)"
    + PRIOR.SOURCE_COMPLETE.split(
        "CREATE FUNCTION inventory_supply_receipt_remaining(receipt_uuid uuid)", 1
    )[1].split("CREATE FUNCTION inventory_supply_source_complete", 1)[0]
)
NEW_REMAINING = OLD_REMAINING.replace(
    "returned numeric;", "returned numeric; released numeric;"
).replace(
    "  IF used+lost+returned>actual",
    """  SELECT COALESCE(SUM(released.quantity),0) INTO released
    FROM inventory_stockoperation operation JOIN releases_release released ON released.id=operation.release_id
    WHERE operation.release_receipt_line_id=receipt_uuid;
  used=used+released;
  IF used+lost+returned>actual""",
)
if NEW_MOVEMENT == OLD_MOVEMENT or NEW_REMAINING == OLD_REMAINING:
    raise ValueError("The canonical inventory consumption boundary changed")

GUARDS = r"""
CREATE FUNCTION inventory_release_operation_guard() RETURNS trigger AS $$
DECLARE released releases_release; receipt inventory_supplyreceiptline;
BEGIN
 IF NEW.release_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO released FROM releases_release WHERE id=NEW.release_id;
 SELECT * INTO receipt FROM inventory_supplyreceiptline WHERE id=NEW.release_receipt_line_id;
 IF released.id IS NULL OR receipt.id IS NULL OR NEW.source_kind<>'release_record'
   OR NEW.source_id IS DISTINCT FROM released.id OR NEW.organization_id IS DISTINCT FROM released.organization_id
   OR NEW.created_by_id IS DISTINCT FROM released.created_by_id OR receipt.organization_id IS DISTINCT FROM NEW.organization_id
   OR NEW.content_hash !~ '^[0-9a-f]{64}$'
   OR NOT EXISTS(SELECT 1 FROM inventory_supplyreceipt signed
     JOIN inventory_supplyevent source ON source.id=signed.event_id
     JOIN inventory_supplyassignment assignment ON assignment.id=source.assignment_id
     JOIN inventory_originreleaseline origin ON origin.id=receipt.release_line_id
     JOIN inventory_supplyassignmentline plan ON plan.id=origin.line_id
     WHERE signed.id=receipt.receipt_id AND assignment.courier_id=released.created_by_id
       AND plan.lot_id=released.lot_id AND released.quantity>0
       AND NOT EXISTS(SELECT 1 FROM inventory_supplyvoidaudit audit WHERE audit.event_id=source.id))
   THEN RAISE EXCEPTION 'Release consumption requires exact genuine owned receipt custody'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER inventory_release_operation_guard BEFORE INSERT ON inventory_stockoperation
FOR EACH ROW EXECUTE FUNCTION inventory_release_operation_guard();

CREATE FUNCTION inventory_release_stock_complete() RETURNS trigger AS $$
DECLARE released releases_release; operation inventory_stockoperation;
BEGIN
 IF TG_TABLE_NAME='releases_release' THEN
   released=NEW;
 ELSIF TG_TABLE_NAME='inventory_stockoperation' THEN
   IF NEW.release_id IS NULL THEN RETURN NEW; END IF;
   SELECT * INTO released FROM releases_release WHERE id=NEW.release_id;
 ELSE
   SELECT * INTO operation FROM inventory_stockoperation WHERE id=NEW.operation_id;
   IF operation.release_id IS NULL THEN RETURN NEW; END IF;
   SELECT * INTO released FROM releases_release WHERE id=operation.release_id;
 END IF;
 SELECT * INTO operation FROM inventory_stockoperation WHERE release_id=released.id;
 IF operation.id IS NULL OR (SELECT COUNT(*) FROM inventory_stockmovement WHERE operation_id=operation.id)<>1
   OR NOT EXISTS(SELECT 1 FROM inventory_supplyreceiptline receipt
     JOIN inventory_supplyreceipt signed ON signed.id=receipt.receipt_id
     JOIN inventory_supplyevent source ON source.id=signed.event_id
     JOIN inventory_originreleaseline origin ON origin.id=receipt.release_line_id
     JOIN inventory_supplyassignmentline plan ON plan.id=origin.line_id
     JOIN inventory_stockmovement movement ON movement.operation_id=operation.id
     WHERE receipt.id=operation.release_receipt_line_id AND movement.line_number=1
       AND movement.organization_id=released.organization_id AND movement.created_by_id=released.created_by_id
       AND movement.lot_id=released.lot_id AND movement.lot_id=plan.lot_id
       AND movement.piece_id IS NOT DISTINCT FROM plan.piece_id
       AND movement.unit_version_id=plan.unit_version_id AND movement.quantity=-released.quantity
       AND movement.assignment_id=source.assignment_id AND movement.location_id IS NULL)
   THEN RAISE EXCEPTION 'Release consumption must retain exactly one same-custodian debit'; END IF;
 PERFORM inventory_supply_receipt_remaining(operation.release_receipt_line_id);
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER inventory_release_stock_complete AFTER INSERT ON releases_release
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_release_stock_complete();
CREATE CONSTRAINT TRIGGER inventory_release_operation_complete AFTER INSERT ON inventory_stockoperation
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_release_stock_complete();
CREATE CONSTRAINT TRIGGER inventory_release_movement_complete AFTER INSERT ON inventory_stockmovement
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_release_stock_complete();
"""
REVERSE = (
    """
DROP TRIGGER inventory_release_movement_complete ON inventory_stockmovement;
DROP TRIGGER inventory_release_operation_complete ON inventory_stockoperation;
DROP TRIGGER inventory_release_stock_complete ON releases_release;
DROP TRIGGER inventory_release_operation_guard ON inventory_stockoperation;
DROP FUNCTION inventory_release_stock_complete(); DROP FUNCTION inventory_release_operation_guard();
"""
    + OLD_MOVEMENT
    + OLD_REMAINING
)


def protect_reverse(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    if apps.get_model("inventory", "StockOperation").objects.filter(release__isnull=False).exists():
        raise IrreversibleError("Retain genuine release consumption and signed custody provenance.")


class Migration(migrations.Migration):
    dependencies = [("inventory", "0009_paddle_return_guards"), ("releases", "0001_initial")]
    operations = [
        migrations.RemoveConstraint(model_name="stockoperation", name="stock_exact_source_branch"),
        migrations.AddField(
            model_name="stockoperation",
            name="release",
            field=models.OneToOneField(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="stock_operation",
                to="releases.release",
            ),
        ),
        migrations.AddField(
            model_name="stockoperation",
            name="release_receipt_line",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="release_operations",
                to="inventory.supplyreceiptline",
            ),
        ),
        migrations.AlterField(
            model_name="stockoperation",
            name="source_kind",
            field=models.CharField(
                max_length=24,
                choices=[
                    (kind, kind)
                    for kind in (
                        "lot_admission",
                        "transfer_dispatch",
                        "transfer_receive",
                        "transfer_resolution",
                        "supply_receive",
                        "supply_reconcile",
                        "supply_return",
                        "lot_write_off",
                        "supply_compensation",
                        "paddle_return",
                        "release_record",
                    )
                ],
            ),
        ),
        migrations.AddConstraint(
            model_name="stockoperation",
            constraint=models.CheckConstraint(
                condition=SOURCE_CONDITION,
                name="stock_exact_source_branch",
            ),
        ),
        migrations.RunSQL(NEW_MOVEMENT + NEW_REMAINING + GUARDS, REVERSE),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
