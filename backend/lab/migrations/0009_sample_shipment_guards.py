"""Canonical sample source lineage and additive shipment completion branch."""

from importlib import import_module

from django.db import migrations
from django.db.migrations.exceptions import IrreversibleError

SAMPLE_GUARDS = r"""
CREATE FUNCTION lab_sample_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Sample facts are insert-only'; END IF;
 IF NEW.created_by_id IS NULL OR NOT EXISTS(
   SELECT 1 FROM field_sync_fieldevent e
   JOIN catalogs_catalogitem origin ON origin.id=NEW.origin_id
   JOIN catalogs_catalog catalog ON catalog.id=origin.catalog_id
   JOIN lab_labmethodversion method ON method.id=NEW.method_version_id
   JOIN lab_labmethod identity ON identity.id=method.method_id
   JOIN inventory_location location ON location.id=NEW.location_id
   JOIN organizations_center center ON center.id=location.center_id
   WHERE e.id=NEW.event_id AND e.organization_id=NEW.organization_id
     AND e.type='sample.collect' AND e.created_by_id=NEW.collector_id AND lab_effective_source(e.id)
     AND origin.organization_id=NEW.organization_id AND catalog.organization_id=NEW.organization_id
     AND catalog.slug='sample-origin' AND method.organization_id=NEW.organization_id
     AND identity.organization_id=NEW.organization_id AND location.organization_id=NEW.organization_id
     AND center.organization_id=NEW.organization_id
     AND (location.quadrant_id IS NULL OR EXISTS(SELECT 1 FROM geography_quadrant q
       WHERE q.id=location.quadrant_id AND q.organization_id=NEW.organization_id AND q.center_id=center.id))
     AND e.payload->>'sample_id'=NEW.id::text AND e.payload->>'code'=NEW.code
     AND e.payload->>'origin_code'=origin.code AND e.payload->>'method_version'=method.id::text
     AND e.payload->'source_ref'=jsonb_build_object(
       'kind', CASE WHEN NEW.reading_id IS NOT NULL THEN 'reading' ELSE 'lot' END,
       'id', coalesce(NEW.reading_id,NEW.lot_id)::text)
 ) THEN RAISE EXCEPTION 'Sample requires its exact effective collection and owned provenance'; END IF;
 IF NEW.reading_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM ovitraps_ovitrapreading reading
   JOIN ovitraps_ovitrap trap ON trap.id=reading.ovitrap_id
   JOIN geography_samplingpoint point ON point.id=trap.sampling_point_id
   JOIN geography_pointversion version ON version.id=reading.point_version_id
   JOIN geography_block block ON block.id=point.block_id
   JOIN geography_quadrant quadrant ON quadrant.id=block.quadrant_id
   JOIN organizations_center center ON center.id=quadrant.center_id
   WHERE reading.id=NEW.reading_id AND reading.organization_id=NEW.organization_id
     AND trap.organization_id=NEW.organization_id AND point.organization_id=NEW.organization_id
     AND version.organization_id=NEW.organization_id AND version.point_id=point.id
     AND block.organization_id=NEW.organization_id AND quadrant.organization_id=NEW.organization_id
     AND center.organization_id=NEW.organization_id
     AND lab_effective_source(reading.event_id) AND lab_effective_source(trap.event_id)
 ) THEN RAISE EXCEPTION 'Sample Reading source invalid'; END IF;
 IF NEW.lot_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM inventory_lot lot JOIN organizations_center center ON center.id=lot.center_id
   WHERE lot.id=NEW.lot_id AND lot.organization_id=NEW.organization_id
     AND center.organization_id=NEW.organization_id
     AND (lot.quadrant_id IS NULL OR EXISTS(SELECT 1 FROM geography_quadrant q
       WHERE q.id=lot.quadrant_id AND q.organization_id=NEW.organization_id AND q.center_id=center.id))
 ) THEN RAISE EXCEPTION 'Sample Lot source invalid'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER lab_wolbachiasample_guard BEFORE INSERT OR UPDATE OR DELETE ON lab_wolbachiasample
 FOR EACH ROW EXECUTE FUNCTION lab_sample_identity_guard();

CREATE FUNCTION shipment_sample_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.sample_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM lab_wolbachiasample sample
   JOIN inventory_location location ON location.id=sample.location_id
   WHERE sample.id=NEW.sample_id AND sample.organization_id=NEW.organization_id
     AND location.organization_id=NEW.organization_id AND location.center_id=NEW.center_id
     AND location.quadrant_id IS NOT DISTINCT FROM NEW.quadrant_id
 ) THEN RAISE EXCEPTION 'Shipment sample context invalid'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER lab_shipmentsource_sample_guard BEFORE INSERT ON lab_shipmentsource
 FOR EACH ROW EXECUTE FUNCTION shipment_sample_source_guard();
"""

COMPLETE = r"""
CREATE OR REPLACE FUNCTION shipment_complete_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE shipment lab_uiebshipment;
BEGIN
 IF TG_TABLE_NAME='lab_uiebshipment' THEN shipment=NEW;
 ELSE SELECT * INTO shipment FROM lab_uiebshipment WHERE id=NEW.shipment_id; END IF;
 IF (SELECT count(*) FROM lab_shipmentsource s WHERE s.shipment_id=shipment.id)<>jsonb_array_length(shipment.source_snapshot)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(shipment.source_snapshot) pin WHERE NOT EXISTS(
     SELECT 1 FROM lab_shipmentsource s WHERE s.shipment_id=shipment.id
       AND ((pin->>'kind'='bag' AND s.bag_id=(pin->>'id')::uuid)
         OR (pin->>'kind'='lot' AND s.lot_id=(pin->>'id')::uuid)
         OR (pin->>'kind'='sample' AND s.sample_id=(pin->>'id')::uuid AND EXISTS(
           SELECT 1 FROM lab_wolbachiasample sample WHERE sample.id=s.sample_id
             AND sample.event_id=(pin->>'source_event_id')::uuid
             AND sample.method_version_id=(pin->>'method_version_id')::uuid
             AND sample.origin_id=(pin->>'origin_id')::uuid
             AND sample.location_id=(pin->>'location_id')::uuid
             AND sample.reading_id IS NOT DISTINCT FROM (pin->>'reading_id')::uuid
             AND sample.lot_id IS NOT DISTINCT FROM (pin->>'lot_id')::uuid
             AND (sample.lot_id IS NULL OR EXISTS(SELECT 1 FROM inventory_lotversion version
               WHERE version.id=(pin->>'lot_version_id')::uuid AND version.lot_id=sample.lot_id
                 AND version.organization_id=sample.organization_id AND version.created_at<=shipment.cutoff))
             AND sample.collector_id=(pin->>'collector_id')::uuid
         )))))
   THEN RAISE EXCEPTION 'Shipment must retain its exact selected sources'; END IF;
 RETURN NEW;
END; $$;
"""

PREVIOUS = import_module("lab.migrations.0007_shipment_fact_guards").FORWARD
OLD_COMPLETE = "CREATE OR REPLACE FUNCTION shipment_complete_guard()" + PREVIOUS.split(
    "CREATE FUNCTION shipment_complete_guard()", 1
)[1].split("CREATE TRIGGER", 1)[0]

REVERSE = OLD_COMPLETE + r"""
DROP TRIGGER lab_shipmentsource_sample_guard ON lab_shipmentsource;
DROP FUNCTION shipment_sample_source_guard();
DROP TRIGGER lab_wolbachiasample_guard ON lab_wolbachiasample;
DROP FUNCTION lab_sample_identity_guard();
"""


def protect_reverse(apps, schema_editor):
    if apps.get_model("lab", "WolbachiaSample").objects.exists() or apps.get_model(
        "lab", "ShipmentSource"
    ).objects.filter(sample__isnull=False).exists():
        raise IrreversibleError("Retain canonical sample and shipment source dependencies.")


class Migration(migrations.Migration):
    dependencies = [("lab", "0008_sample_shipment_sources")]
    operations = [
        migrations.RunSQL(SAMPLE_GUARDS + COMPLETE, REVERSE),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
