"""Retain shipment provenance, verified notification and signed delivery dependencies."""

from django.db import migrations
from django.db.migrations.exceptions import IrreversibleError

TABLES = ("lab_uiebshipment", "lab_shipmentsource", "lab_shipmentvoid", "lab_materialrequest", "lab_notificationevidence", "lab_deliveryreceipt", "lab_materialrequestvoid")

FORWARD = r"""
CREATE FUNCTION shipment_fact_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Shipment facts are insert-only'; END IF;
 IF NEW.created_by_id IS NULL THEN RAISE EXCEPTION 'Shipment facts require an author'; END IF;
 IF TG_TABLE_NAME IN ('lab_materialrequestvoid','lab_shipmentvoid') THEN
   IF length(NEW.reason)>1000 OR length(regexp_replace(NEW.reason, '[[:space:]]', '', 'g'))<10
     THEN RAISE EXCEPTION 'Shipment correction requires a substantive bounded reason'; END IF;
 END IF;
 IF TG_TABLE_NAME='lab_materialrequest' THEN
   IF NOT EXISTS(SELECT 1 FROM inventory_lot l JOIN inventory_location p ON p.id=NEW.location_id
      JOIN inventory_supplytypeversion u ON u.id=NEW.unit_version_id
      WHERE l.id=NEW.lot_id AND l.organization_id=NEW.organization_id
        AND p.organization_id=NEW.organization_id AND u.organization_id=NEW.organization_id
        AND u.supply_type_id=l.supply_id
        AND ((u.identity_kind='piece' AND NEW.piece_id IS NOT NULL AND NEW.quantity=1)
          OR (u.identity_kind='lot' AND NEW.piece_id IS NULL)))
      OR (NEW.piece_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM inventory_piece p
        WHERE p.id=NEW.piece_id AND p.lot_id=NEW.lot_id AND p.organization_id=NEW.organization_id))
      THEN RAISE EXCEPTION 'Material request relations invalid'; END IF;
 ELSIF TG_TABLE_NAME IN ('lab_notificationevidence','lab_deliveryreceipt','lab_materialrequestvoid') THEN
   IF NOT EXISTS(SELECT 1 FROM lab_materialrequest r WHERE r.id=NEW.request_id AND r.organization_id=NEW.organization_id)
      THEN RAISE EXCEPTION 'Material request parent invalid'; END IF;
   IF TG_TABLE_NAME='lab_deliveryreceipt' THEN
     IF EXISTS(SELECT 1 FROM lab_materialrequestvoid v WHERE v.request_id=NEW.request_id)
       OR NOT EXISTS(SELECT 1 FROM lab_notificationevidence n JOIN uploads_uploadverification v ON v.upload_id=n.upload_id
          JOIN uploads_attachmentlink a ON a.upload_id=n.upload_id AND a.material_request_id=n.request_id
          WHERE n.request_id=NEW.request_id AND n.organization_id=NEW.organization_id)
       OR NEW.expected_revision<>(SELECT count(*) FROM lab_notificationevidence n WHERE n.request_id=NEW.request_id)
       OR NOT EXISTS(SELECT 1 FROM uploads_upload u JOIN uploads_uploadverification v ON v.upload_id=u.id
          WHERE u.id=NEW.signature_id AND u.organization_id=NEW.organization_id AND u.uploader_id=NEW.created_by_id)
       THEN RAISE EXCEPTION 'Delivery requires current notification, revision and verified signature'; END IF;
   ELSIF TG_TABLE_NAME='lab_notificationevidence' THEN
     IF EXISTS(SELECT 1 FROM lab_deliveryreceipt d WHERE d.request_id=NEW.request_id)
       OR EXISTS(SELECT 1 FROM lab_materialrequestvoid v WHERE v.request_id=NEW.request_id)
       OR NOT EXISTS(SELECT 1 FROM uploads_upload u JOIN uploads_uploadverification v ON v.upload_id=u.id
          WHERE u.id=NEW.upload_id AND u.organization_id=NEW.organization_id AND u.uploader_id=NEW.created_by_id)
       THEN RAISE EXCEPTION 'Notification requires open request and verified owned evidence'; END IF;
   ELSIF EXISTS(SELECT 1 FROM lab_deliveryreceipt d WHERE d.request_id=NEW.request_id) THEN
     RAISE EXCEPTION 'Delivered material cannot be voided without genuine compensation';
   END IF;
 ELSIF TG_TABLE_NAME='lab_shipmentsource' THEN
   IF NOT EXISTS(SELECT 1 FROM lab_uiebshipment s WHERE s.id=NEW.shipment_id AND s.organization_id=NEW.organization_id)
     OR NOT EXISTS(SELECT 1 FROM organizations_center c WHERE c.id=NEW.center_id AND c.organization_id=NEW.organization_id)
     OR (NEW.quadrant_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM geography_quadrant q WHERE q.id=NEW.quadrant_id AND q.center_id=NEW.center_id AND q.organization_id=NEW.organization_id))
     OR (NEW.bag_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ovitraps_bag b
         JOIN ovitraps_ovitrapreading r ON r.id=b.reading_id JOIN ovitraps_ovitrap o ON o.id=r.ovitrap_id
         JOIN geography_samplingpoint p ON p.id=o.sampling_point_id JOIN geography_block k ON k.id=p.block_id
         WHERE b.id=NEW.bag_id AND b.organization_id=NEW.organization_id AND k.quadrant_id=NEW.quadrant_id))
     OR (NEW.lot_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM inventory_lot l WHERE l.id=NEW.lot_id AND l.organization_id=NEW.organization_id
         AND l.center_id=NEW.center_id AND l.quadrant_id IS NOT DISTINCT FROM NEW.quadrant_id))
     THEN RAISE EXCEPTION 'Shipment source relations invalid'; END IF;
 ELSIF TG_TABLE_NAME='lab_uiebshipment' THEN
   IF NEW.supersedes_id IS NOT NULL THEN
     IF length(NEW.reason)>1000 OR length(regexp_replace(NEW.reason, '[[:space:]]', '', 'g'))<10
       THEN RAISE EXCEPTION 'Shipment supersession requires a substantive bounded reason'; END IF;
   END IF;
   IF jsonb_typeof(NEW.source_snapshot)<>'array' OR jsonb_array_length(NEW.source_snapshot)=0
     OR (NEW.supersedes_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lab_uiebshipment p WHERE p.id=NEW.supersedes_id AND p.organization_id=NEW.organization_id))
     THEN RAISE EXCEPTION 'Shipment snapshot/predecessor invalid'; END IF;
 ELSIF TG_TABLE_NAME='lab_shipmentvoid' THEN
   IF NOT EXISTS(SELECT 1 FROM lab_uiebshipment s WHERE s.id=NEW.shipment_id AND s.organization_id=NEW.organization_id)
     OR EXISTS(SELECT 1 FROM lab_uiebshipment s WHERE s.supersedes_id=NEW.shipment_id)
     THEN RAISE EXCEPTION 'Shipment correction has dependents'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE FUNCTION shipment_complete_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE shipment lab_uiebshipment;
BEGIN
 IF TG_TABLE_NAME='lab_uiebshipment' THEN shipment=NEW;
 ELSE SELECT * INTO shipment FROM lab_uiebshipment WHERE id=NEW.shipment_id; END IF;
 IF (SELECT count(*) FROM lab_shipmentsource s WHERE s.shipment_id=shipment.id)<>jsonb_array_length(shipment.source_snapshot)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(shipment.source_snapshot) pin WHERE NOT EXISTS(
     SELECT 1 FROM lab_shipmentsource s WHERE s.shipment_id=shipment.id
       AND ((pin->>'kind'='bag' AND s.bag_id=(pin->>'id')::uuid) OR (pin->>'kind'='lot' AND s.lot_id=(pin->>'id')::uuid))))
   THEN RAISE EXCEPTION 'Shipment must retain its exact selected sources'; END IF;
 RETURN NEW;
END; $$;
""" + "\n".join(
    f"CREATE TRIGGER {table}_guard BEFORE INSERT OR UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION shipment_fact_guard();"
    for table in TABLES
) + "\n" + "\n".join(
    f"CREATE CONSTRAINT TRIGGER {table}_complete_guard AFTER INSERT ON {table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION shipment_complete_guard();"
    for table in ("lab_uiebshipment", "lab_shipmentsource")
)

REVERSE = "\n".join(
    f"DROP TRIGGER {table}_complete_guard ON {table};" for table in ("lab_uiebshipment", "lab_shipmentsource")
) + "\n" + "\n".join(f"DROP TRIGGER {table}_guard ON {table};" for table in reversed(TABLES)) + "\nDROP FUNCTION shipment_complete_guard(); DROP FUNCTION shipment_fact_guard();"


def protect_reverse(apps, schema_editor):
    for name in ("UiebShipment", "MaterialRequest"):
        if apps.get_model("lab", name).objects.exists():
            raise IrreversibleError("Retain issued shipment and material custody history.")


class Migration(migrations.Migration):
    dependencies = [("lab", "0006_shipments"), ("inventory", "0012_material_delivery_guards"), ("uploads", "0010_shipments")]
    operations = [migrations.RunSQL(FORWARD, REVERSE), migrations.RunPython(migrations.RunPython.noop, protect_reverse)]
