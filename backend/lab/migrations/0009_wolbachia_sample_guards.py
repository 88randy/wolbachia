"""Retain sample audit and coherent tenant/source/method/result command chains."""

from importlib import import_module

from django.db import migrations
from django.db.migrations.exceptions import IrreversibleError

TABLES = ("wolbachiasample", "samplereceipt", "wolbachiaresultattempt", "samplecommandreceipt")

FUNCTIONS = r"""
CREATE FUNCTION lab_sample_method_valid(tenant uuid, identifier uuid, at_time timestamptz)
RETURNS boolean AS $$
 SELECT EXISTS(SELECT 1 FROM lab_labmethodversion m
   JOIN lab_labmethodverification proof ON proof.method_version_id=m.id
   WHERE m.id=identifier AND m.organization_id=tenant AND proof.organization_id=tenant
   AND m.supports_wolbachia AND btrim(m.procedure)<>'' AND btrim(m.reference)<>''
   AND m.created_at<=at_time AND m.effective_from<=at_time
   AND m.id=(SELECT id FROM lab_labmethodversion v WHERE v.method_id=m.method_id
     AND v.created_at<=at_time AND v.effective_from<=at_time ORDER BY effective_from DESC,revision DESC LIMIT 1)
   AND proof.id=(SELECT id FROM lab_labmethodverification v WHERE v.method_version_id=m.id
     AND v.created_at<=at_time ORDER BY revision DESC LIMIT 1)
   AND proof.decision='verify' AND proof.content_hash=m.content_hash);
$$ LANGUAGE sql;

CREATE FUNCTION lab_sample_lock() RETURNS trigger AS $$
BEGIN
 PERFORM 1 FROM organizations_organization WHERE id=NEW.organization_id AND is_active
 FOR NO KEY UPDATE NOWAIT;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM organizations_membership
   WHERE organization_id=NEW.organization_id AND user_id=NEW.created_by_id)
 THEN RAISE EXCEPTION 'Sample requires a real organization and author'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION lab_sample_complete() RETURNS trigger AS $$
DECLARE relation record; parent_org uuid; parent_id uuid; frame jsonb;
        sample record; source record; predecessor record; method record; verification record;
BEGIN
 frame:=to_jsonb(NEW);
 FOR relation IN
  SELECT c.confrelid::regclass AS target,a.attname AS local_field,b.attname AS target_field
  FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
  JOIN pg_attribute b ON b.attrelid=c.confrelid AND b.attnum=c.confkey[1]
  WHERE c.conrelid=TG_RELID AND c.contype='f' AND cardinality(c.conkey)=1
  AND EXISTS(SELECT 1 FROM pg_attribute p WHERE p.attrelid=c.confrelid
             AND p.attname='organization_id' AND NOT p.attisdropped)
 LOOP
  parent_id:=(frame->>relation.local_field)::uuid;
  IF parent_id IS NOT NULL THEN
   EXECUTE format('SELECT organization_id FROM %s WHERE %I=$1',relation.target,relation.target_field)
   INTO parent_org USING parent_id;
   IF parent_org IS DISTINCT FROM NEW.organization_id
   THEN RAISE EXCEPTION 'Sample parent tenant mismatch'; END IF;
  END IF;
 END LOOP;
 IF TG_TABLE_NAME='lab_wolbachiasample' THEN
  SELECT * INTO source FROM field_sync_fieldevent WHERE id=NEW.event_id;
  IF source.type<>'sample.collect' OR source.created_by_id IS DISTINCT FROM NEW.created_by_id
   OR NOT lab_effective_source(source.id)
   OR (source.payload->>'sample_id')::uuid<>NEW.id OR source.payload->>'code'<>NEW.code
   OR (source.payload->>'method_version')::uuid<>NEW.method_version_id
   OR source.device_time<>NEW.device_time OR source.server_received_at<>NEW.server_received_at
  THEN RAISE EXCEPTION 'Sample must retain its effective declared collection'; END IF;
  IF NEW.quadrant_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM geography_quadrant
     WHERE id=NEW.quadrant_id AND center_id=NEW.center_id AND organization_id=NEW.organization_id)
  THEN RAISE EXCEPTION 'Sample source pair mismatch'; END IF;
  IF NEW.reading_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM ovitraps_ovitrapreading r JOIN ovitraps_ovitrap o ON o.id=r.ovitrap_id
   JOIN geography_samplingpoint p ON p.id=o.sampling_point_id
   JOIN geography_block b ON b.id=p.block_id JOIN geography_quadrant q ON q.id=b.quadrant_id
   JOIN field_sync_fieldevent e ON e.id=r.event_id
   WHERE r.id=NEW.reading_id AND q.id=NEW.quadrant_id AND q.center_id=NEW.center_id
     AND e.created_by_id=NEW.created_by_id AND lab_effective_source(e.id)
     AND source.payload->'source_ref'->>'kind'='reading'
     AND (source.payload->'source_ref'->>'id')::uuid=r.id)
  THEN RAISE EXCEPTION 'Sample reading provenance mismatch'; END IF;
  IF NEW.lot_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM inventory_lot l
    WHERE l.id=NEW.lot_id AND l.center_id=NEW.center_id
    AND l.quadrant_id IS NOT DISTINCT FROM NEW.quadrant_id
    AND source.payload->'source_ref'->>'kind'='lot'
    AND (source.payload->'source_ref'->>'id')::uuid=l.id)
  THEN RAISE EXCEPTION 'Sample lot provenance mismatch'; END IF;
  IF NEW.release_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM releases_release r JOIN releases_permitversion v ON v.id=r.permit_version_id
    JOIN releases_permit p ON p.id=v.permit_id
    WHERE r.id=NEW.release_id AND p.center_id=NEW.center_id AND p.quadrant_id=NEW.quadrant_id
    AND r.created_by_id=NEW.created_by_id AND lab_effective_source(r.declared_event_id)
    AND source.payload->'source_ref'->>'kind'='release'
    AND (source.payload->'source_ref'->>'id')::uuid=r.id)
  THEN RAISE EXCEPTION 'Sample release provenance mismatch'; END IF;
  IF NOT lab_sample_method_valid(NEW.organization_id,NEW.method_version_id,NEW.device_time)
    OR NOT lab_sample_method_valid(NEW.organization_id,NEW.method_version_id,NEW.created_at)
  THEN RAISE EXCEPTION 'Sample requires a verified Wolbachia method'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO sample FROM lab_wolbachiasample WHERE id=NEW.sample_id;
 IF NOT lab_effective_source(sample.event_id)
 THEN RAISE EXCEPTION 'Sample command requires effective collection'; END IF;
 IF TG_TABLE_NAME='lab_wolbachiaresultattempt' THEN
  IF NOT EXISTS(SELECT 1 FROM lab_samplereceipt WHERE sample_id=sample.id)
  THEN RAISE EXCEPTION 'Sample results require real reception'; END IF;
  SELECT * INTO predecessor FROM lab_wolbachiaresultattempt
   WHERE sample_id=sample.id AND id<>NEW.id AND revision<NEW.revision ORDER BY revision DESC LIMIT 1;
  IF (NEW.revision=1 AND (NEW.repeat_of_id IS NOT NULL OR predecessor.id IS NOT NULL))
    OR (NEW.revision>1 AND (predecessor.id IS NULL OR predecessor.status='valid'
      OR predecessor.id IS DISTINCT FROM NEW.repeat_of_id OR NEW.revision<>predecessor.revision+1))
  THEN RAISE EXCEPTION 'Sample repeat must follow latest invalid or disputed attempt'; END IF;
  SELECT * INTO method FROM lab_labmethodversion WHERE id=NEW.method_version_id;
  SELECT * INTO verification FROM lab_labmethodverification WHERE id=NEW.method_verification_id;
  IF NOT method.supports_wolbachia OR method.effective_from>NEW.created_at
    OR btrim(method.procedure)='' OR btrim(method.reference)=''
    OR verification.method_version_id<>method.id OR verification.decision<>'verify'
    OR verification.content_hash<>method.content_hash
    OR verification.id IS DISTINCT FROM (SELECT id FROM lab_labmethodverification
      WHERE method_version_id=method.id AND created_at<=NEW.created_at ORDER BY revision DESC LIMIT 1)
    OR method.id IS DISTINCT FROM (SELECT id FROM lab_labmethodversion
      WHERE method_id=method.method_id AND effective_from<=NEW.created_at
      ORDER BY effective_from DESC,revision DESC LIMIT 1)
  THEN RAISE EXCEPTION 'Sample result method proof invalid'; END IF;
 END IF;
 IF TG_TABLE_NAME IN ('lab_samplereceipt','lab_wolbachiaresultattempt') AND NOT EXISTS(
   SELECT 1 FROM lab_samplecommandreceipt c WHERE c.sample_id=sample.id
   AND c.organization_id=NEW.organization_id AND c.command_id=NEW.command_id
   AND c.created_by_id=NEW.created_by_id
   AND c.action=CASE WHEN TG_TABLE_NAME='lab_samplereceipt' THEN 'receive' ELSE 'results' END)
 THEN RAISE EXCEPTION 'Sample fact requires its committed command receipt'; END IF;
 IF TG_TABLE_NAME='lab_samplecommandreceipt' THEN
 IF NOT (
   (NEW.action='receive' AND EXISTS(SELECT 1 FROM lab_samplereceipt r WHERE r.sample_id=sample.id
     AND r.command_id=NEW.command_id AND r.created_by_id=NEW.created_by_id)) OR
   (NEW.action='results' AND EXISTS(SELECT 1 FROM lab_wolbachiaresultattempt r WHERE r.sample_id=sample.id
     AND r.command_id=NEW.command_id AND r.created_by_id=NEW.created_by_id)))
 THEN RAISE EXCEPTION 'Sample command receipt requires its actual effect'; END IF;
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION lab_sample_source_void_guard() RETURNS trigger AS $$
BEGIN
 IF NEW.voided_at IS NOT NULL AND OLD.voided_at IS NULL AND EXISTS(
   SELECT 1 FROM lab_wolbachiasample s JOIN field_sync_fieldevent collection ON collection.id=s.event_id
   LEFT JOIN ovitraps_ovitrapreading r ON r.id=s.reading_id
   LEFT JOIN releases_release released ON released.id=s.release_id
   WHERE collection.voided_at IS NULL AND (r.event_id=NEW.id OR released.declared_event_id=NEW.id
     OR (s.event_id=NEW.id AND (EXISTS(SELECT 1 FROM lab_samplereceipt WHERE sample_id=s.id)
       OR EXISTS(SELECT 1 FROM lab_wolbachiaresultattempt WHERE sample_id=s.id)))))
 THEN RAISE EXCEPTION 'Sample source has retained dependents'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER lab_sample_source_void_guard BEFORE UPDATE OF voided_at ON field_sync_fieldevent
 FOR EACH ROW EXECUTE FUNCTION lab_sample_source_void_guard();
"""

FORWARD = FUNCTIONS + "\n".join(
    f"""
CREATE TRIGGER lab_sample_lock BEFORE INSERT ON lab_{table}
 FOR EACH ROW EXECUTE FUNCTION lab_sample_lock();
CREATE TRIGGER lab_{table}_guard BEFORE UPDATE OR DELETE ON lab_{table}
 FOR EACH ROW EXECUTE FUNCTION lab_insert_only_guard();
CREATE CONSTRAINT TRIGGER lab_sample_complete AFTER INSERT ON lab_{table}
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lab_sample_complete();
"""
    for table in TABLES
)
REVERSE = (
    "\n".join(
        f"DROP TRIGGER lab_sample_complete ON lab_{table};"
        f"DROP TRIGGER lab_{table}_guard ON lab_{table};"
        f"DROP TRIGGER lab_sample_lock ON lab_{table};"
        for table in TABLES
    )
    + """
DROP TRIGGER lab_sample_source_void_guard ON field_sync_fieldevent;
DROP FUNCTION lab_sample_source_void_guard();
DROP FUNCTION lab_sample_complete();
DROP FUNCTION lab_sample_lock();
DROP FUNCTION lab_sample_method_valid(uuid,uuid,timestamptz);
"""
)


SHIPMENT_SOURCE_GUARD = r"""
CREATE OR REPLACE FUNCTION shipment_sample_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.sample_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM lab_wolbachiasample sample
   WHERE sample.id=NEW.sample_id AND sample.organization_id=NEW.organization_id
     AND sample.center_id=NEW.center_id
     AND sample.quadrant_id IS NOT DISTINCT FROM NEW.quadrant_id
 ) THEN RAISE EXCEPTION 'Shipment sample context invalid'; END IF;
 RETURN NEW;
END; $$;
"""

SHIPMENT_COMPLETE = r"""
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
             AND (CASE WHEN pin ? 'location_id' THEN
               sample.source_provenance->'legacy_identity'->>'origin_id'=pin->>'origin_id'
               AND sample.source_provenance->'legacy_identity'->>'location_id'=pin->>'location_id'
             ELSE sample.origin_snapshot=pin->'origin_snapshot'
               AND sample.location=pin->'location'
               AND sample.source_provenance=pin->'source_provenance'
               AND sample.center_id=(pin->>'center_id')::uuid
               AND sample.quadrant_id IS NOT DISTINCT FROM (pin->>'quadrant_id')::uuid
               AND sample.release_id IS NOT DISTINCT FROM (pin->>'release_id')::uuid
             END)
             AND sample.reading_id IS NOT DISTINCT FROM (pin->>'reading_id')::uuid
             AND sample.lot_id IS NOT DISTINCT FROM (pin->>'lot_id')::uuid
             AND (sample.lot_id IS NULL OR EXISTS(SELECT 1 FROM inventory_lotversion version
               WHERE version.id=(pin->>'lot_version_id')::uuid AND version.lot_id=sample.lot_id
                 AND version.organization_id=sample.organization_id AND version.created_at<=shipment.cutoff))
             AND sample.created_by_id=(pin->>'collector_id')::uuid
         )))))
   THEN RAISE EXCEPTION 'Shipment must retain its exact selected sources'; END IF;
 RETURN NEW;
END; $$;
"""
LEGACY_SHIPMENT = import_module("lab.migrations.0007_shipment_fact_guards")
LEGACY_SOURCE_GUARD = (
    "CREATE OR REPLACE FUNCTION shipment_sample_source_guard()"
    + (
        LEGACY_SHIPMENT.SAMPLE_GUARDS.split("CREATE FUNCTION shipment_sample_source_guard()", 1)[
            1
        ].split("CREATE TRIGGER lab_shipmentsource_sample_guard", 1)[0]
    )
)


def protect_reverse(apps, schema_editor):
    if (
        any(apps.get_model("lab", model).objects.exists() for model in TABLES)
        or apps.get_model("lab", "LabMethodVersion")
        .objects.filter(supports_wolbachia=True)
        .exists()
    ):
        raise IrreversibleError("Retain Wolbachia sample, method and result audit.")


class Migration(migrations.Migration):
    dependencies = [("lab", "0008_wolbachia_samples"), ("releases", "0005_semantic_source_uuids")]
    operations = [
        migrations.RunSQL(
            SHIPMENT_SOURCE_GUARD + SHIPMENT_COMPLETE,
            LEGACY_SOURCE_GUARD + LEGACY_SHIPMENT.SAMPLE_COMPLETE,
        ),
        migrations.RunSQL(FORWARD, REVERSE),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
