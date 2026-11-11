"""A courier receipt may carry no signature of its own when the release was signed at the warehouse.

The relaxed database guards still demand the exact verified signature whenever one is given, and
accept none only when the release proof records the warehouse-screen signature.
"""

from importlib import import_module

from django.db import migrations, models

PRIOR = import_module("inventory.migrations.0006_courier_supply_guards")

OLD_CHECK = PRIOR.CHECKS["supplyreceipt"]
CHECK_TAIL = "\n      AND jsonb_typeof(NEW.observations)='array'"
if CHECK_TAIL not in OLD_CHECK:
    raise ValueError("The canonical supply receipt guard changed")
OLD_EXISTS = OLD_CHECK.split(CHECK_TAIL, 1)[0]
NO_SIGNATURE_EXISTS = """EXISTS(SELECT 1 FROM inventory_supplyevent e
      JOIN inventory_originreleaseproof p ON p.id=NEW.release_id
      JOIN inventory_supplyassignmentversion v ON v.id=p.version_id
      WHERE e.id=NEW.event_id AND e.kind='receive' AND e.organization_id=NEW.organization_id
      AND p.organization_id=NEW.organization_id AND v.assignment_id=e.assignment_id
      AND e.canonical_input->>'signature_upload_id' IS NULL
      AND NEW.created_by_id=e.created_by_id AND e.canonical_input->>'release_id'=p.id::text
      AND (e.canonical_input->>'plan_revision')::integer=v.revision
      AND p.proof->'signature' IS NOT NULL)"""
NEW_CHECK = (
    f"((NEW.signature_id IS NULL AND {NO_SIGNATURE_EXISTS})"
    f" OR (NEW.signature_id IS NOT NULL AND {OLD_EXISTS})){CHECK_TAIL}"
)
GUARD = f"""CREATE OR REPLACE FUNCTION inventory_supplyreceipt_supply_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.created_by_id IS NULL OR NOT COALESCE(({NEW_CHECK}),false) THEN
    RAISE EXCEPTION 'supply identity, source or organization mismatch';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
"""
OLD_GUARD = GUARD.replace(NEW_CHECK, OLD_CHECK)

START = "CREATE FUNCTION inventory_supply_source_complete"
OLD_SOURCE = (
    "CREATE OR REPLACE FUNCTION inventory_supply_source_complete"
    + PRIOR.SOURCE_COMPLETE.split(START, 1)[1].split("\nCREATE FUNCTION", 1)[0]
)
OLD_PARENT_HEAD = "IF signed_receipt.id IS NULL OR NOT EXISTS(SELECT 1 FROM uploads_attachmentlink link"
OLD_PARENT_TAIL = "AND upload.device_id=source.device_id)\n      THEN RAISE EXCEPTION 'signed receipt requires"
NEW_SOURCE = OLD_SOURCE.replace(
    OLD_PARENT_HEAD,
    "IF signed_receipt.id IS NULL OR (signed_receipt.signature_id IS NOT NULL AND NOT EXISTS("
    "SELECT 1 FROM uploads_attachmentlink link",
).replace(
    OLD_PARENT_TAIL,
    "AND upload.device_id=source.device_id))\n      THEN RAISE EXCEPTION 'signed receipt requires",
)
if NEW_SOURCE == OLD_SOURCE or OLD_PARENT_HEAD not in OLD_SOURCE or OLD_PARENT_TAIL not in OLD_SOURCE:
    raise ValueError("The canonical supply source completion changed")


class Migration(migrations.Migration):
    dependencies = [("inventory", "0011_shipments")]
    operations = [
        migrations.AlterField(
            model_name="supplyreceipt",
            name="signature",
            field=models.ForeignKey(
                null=True,
                on_delete=models.deletion.PROTECT,
                related_name="+",
                to="uploads.upload",
            ),
        ),
        migrations.RunSQL(GUARD + NEW_SOURCE, OLD_GUARD + OLD_SOURCE),
    ]
