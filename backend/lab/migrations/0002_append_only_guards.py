"""Lab audit, coherent source/result chains and protected populated reversal.

Only this new app's facts and its exact extra parent/source branches are added.
All existing source/upload/incident SQL functions remain untouched.
"""

from django.db import migrations
from django.db.migrations.exceptions import IrreversibleError

TABLES = (
    "lab_labcommand", "lab_labcommandresult", "lab_bagreceipt",
    "lab_receptiondiscrepancy", "lab_receptionincidentpolicyversion", "lab_receptionincidentlink",
    "lab_labmethod", "lab_labmethodversion", "lab_labmethodverification",
    "lab_eggcountattempt", "lab_labrejection", "lab_labresultvoid", "lab_labresultrevision",
    "lab_recountrequest", "lab_recountrequestcause", "lab_recountrequestsupersession",
    "lab_dailyrecountsample", "lab_dailyrecountsamplemember",
)

FUNCTIONS = r"""
CREATE FUNCTION lab_effective_source(identifier uuid) RETURNS boolean AS $$
    SELECT EXISTS(SELECT 1 FROM field_sync_fieldevent e
      WHERE e.id=identifier AND e.voided_at IS NULL AND (e.status='accepted' OR EXISTS(
        SELECT 1 FROM reviews_revieweffectreceipt r WHERE r.source_event_id=e.id AND r.payload_sha256=e.payload_sha256)));
$$ LANGUAGE sql;

CREATE FUNCTION lab_rules_are_pinned(tenant uuid, captured jsonb) RETURNS boolean AS $$
    SELECT captured ?& ARRAY['lab_count_plausibility_limit','lab_recount_sample_per_100','_captured_at']
      AND (captured->'lab_count_plausibility_limit'->>'value')::numeric BETWEEN 100 AND 10000
      AND (captured->'lab_recount_sample_per_100'->>'value')::numeric BETWEEN 1 AND 20
      AND (SELECT count(*)=2 FROM jsonb_each(captured) entry
        JOIN rules_ruleparameter p ON p.key=entry.key AND p.organization_id=tenant
        JOIN rules_ruleparameterversion v ON v.parameter_id=p.id AND v.id=(entry.value->>'version_id')::uuid
        WHERE entry.key IN ('lab_count_plausibility_limit','lab_recount_sample_per_100')
          AND p.value_type='integer' AND p.unit='count' AND v.value=(entry.value->>'value')::numeric
          AND v.value=trunc(v.value) AND v.voided_at IS NULL
          AND v.effective_from=(entry.value->>'effective_from')::timestamptz
          AND v.id=(SELECT active.id FROM rules_ruleparameterversion active WHERE active.parameter_id=p.id
            AND active.voided_at IS NULL AND active.effective_from<=(captured->>'_captured_at')::timestamptz
            ORDER BY active.effective_from DESC,active.created_at DESC LIMIT 1));
$$ LANGUAGE sql;

CREATE FUNCTION lab_insert_only_guard() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Lab audit records are insert-only'; END; $$ LANGUAGE plpgsql;

CREATE FUNCTION lab_insert_guard() RETURNS trigger AS $$
DECLARE relation record; parent_org uuid; rowdata jsonb; parent_id uuid; expected_revision integer;
        metadata jsonb; verification record;
BEGIN
    PERFORM 1 FROM organizations_organization WHERE id=NEW.organization_id AND is_active
      FOR NO KEY UPDATE NOWAIT;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lab requires an active real organization'; END IF;
    rowdata := to_jsonb(NEW);
    IF NEW.created_by_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM organizations_membership m
      WHERE m.organization_id=NEW.organization_id AND m.user_id=NEW.created_by_id)
      THEN RAISE EXCEPTION 'Lab author belongs to another organization'; END IF;
    FOR relation IN
      SELECT c.confrelid::regclass AS target, a.attname AS local_field, b.attname AS target_field
      FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
      JOIN pg_attribute b ON b.attrelid=c.confrelid AND b.attnum=c.confkey[1]
      WHERE c.conrelid=TG_RELID AND c.contype='f' AND cardinality(c.conkey)=1
      AND EXISTS(SELECT 1 FROM pg_attribute p WHERE p.attrelid=c.confrelid
        AND p.attname='organization_id' AND NOT p.attisdropped)
    LOOP
      parent_id := (rowdata->>relation.local_field)::uuid;
      IF parent_id IS NOT NULL THEN
        EXECUTE format('SELECT organization_id FROM %s WHERE %I=$1',relation.target,relation.target_field)
          INTO parent_org USING parent_id;
        IF parent_org IS DISTINCT FROM NEW.organization_id THEN
          RAISE EXCEPTION 'Lab parent tenant mismatch'; END IF;
      END IF;
    END LOOP;

    IF TG_TABLE_NAME='lab_labcommand' THEN
      IF NOT EXISTS(SELECT 1 FROM field_sync_fieldevent e WHERE e.id=NEW.source_id
        AND e.organization_id=NEW.organization_id) THEN RAISE EXCEPTION 'Lab command source missing'; END IF;
    ELSIF TG_TABLE_NAME='lab_labcommandresult' THEN
      IF NOT EXISTS(SELECT 1 FROM lab_labcommand c WHERE c.id=NEW.command_id
        AND c.created_by_id=NEW.created_by_id) OR NEW.status NOT IN (200,201,409)
        OR jsonb_typeof(NEW.subjects)<>'array' OR jsonb_array_length(NEW.subjects)=0
        THEN RAISE EXCEPTION 'Lab result command/subjects invalid'; END IF;
      FOR metadata IN SELECT value FROM jsonb_array_elements(NEW.subjects) LOOP
        IF metadata->>'permission' NOT IN ('bag.receive','egg_count.create','egg_count.void','lab_rejection.create','field.upload')
          OR NOT EXISTS(SELECT 1 FROM ovitraps_ovitrapreading r WHERE r.id=(metadata->>'reading_id')::uuid
            AND r.organization_id=NEW.organization_id) THEN RAISE EXCEPTION 'Lab result subject invalid'; END IF;
      END LOOP;
    ELSIF TG_TABLE_NAME='lab_bagreceipt' THEN
      IF NOT EXISTS(SELECT 1 FROM lab_labcommand c WHERE c.id=NEW.command_id
        AND c.created_by_id=NEW.created_by_id AND c.source_id=NEW.source_id
        AND ((c.action='receive' AND c.target_id=NEW.bag_id) OR (c.action='receive_reading' AND c.target_id=NEW.reading_id)))
        THEN RAISE EXCEPTION 'Lab receipt must retain its exact authored command'; END IF;
      IF NOT EXISTS(SELECT 1 FROM ovitraps_ovitrapreading r WHERE r.id=NEW.reading_id
        AND r.event_id=NEW.source_id AND lab_effective_source(r.event_id)
        AND ((NEW.kind='no_paddle' AND NEW.bag_id IS NULL AND NOT r.paddle_present)
          OR (NEW.kind='bag' AND r.paddle_present AND EXISTS(SELECT 1 FROM ovitraps_bag b
            JOIN field_sync_fieldevent e ON e.id=r.event_id
            WHERE b.id=NEW.bag_id AND b.reading_id=r.id AND b.event_id=r.event_id AND b.collector_id=e.created_by_id))))
        THEN RAISE EXCEPTION 'Lab receipt requires its exact effective paddle source'; END IF;
    ELSIF TG_TABLE_NAME='lab_receptiondiscrepancy' THEN
      IF NOT EXISTS(SELECT 1 FROM ovitraps_bag b JOIN ovitraps_ovitrapreading r ON r.id=b.reading_id
        WHERE b.id=NEW.bag_id AND b.event_id=NEW.source_id AND r.event_id=NEW.source_id
        AND ((NEW.kind='no_reading' AND NOT lab_effective_source(r.event_id))
          OR (NEW.kind='missing' AND lab_effective_source(r.event_id) AND r.paddle_present
            AND NOT EXISTS(SELECT 1 FROM lab_bagreceipt p WHERE p.bag_id=b.id))))
        THEN RAISE EXCEPTION 'Lab discrepancy needs an authentic applicable source'; END IF;
    ELSIF TG_TABLE_NAME='lab_labmethodversion' THEN
      SELECT COALESCE(MAX(revision),0)+1 INTO expected_revision FROM lab_labmethodversion WHERE method_id=NEW.method_id;
      IF NEW.revision<>expected_revision THEN RAISE EXCEPTION 'Lab method revision fork'; END IF;
      IF btrim(NEW.name)='' OR btrim(NEW.procedure)='' OR btrim(NEW.reference)=''
        THEN RAISE EXCEPTION 'Lab method requires its named referenced procedure'; END IF;
    ELSIF TG_TABLE_NAME='lab_receptionincidentpolicyversion' THEN
      SELECT COALESCE(MAX(revision),0)+1 INTO expected_revision FROM lab_receptionincidentpolicyversion WHERE organization_id=NEW.organization_id;
      IF NEW.revision<>expected_revision THEN RAISE EXCEPTION 'Lab incident policy revision fork'; END IF;
    ELSIF TG_TABLE_NAME='lab_receptionincidentlink' THEN
      IF NEW.actor_kind<>'system' OR NEW.created_by_id IS NOT NULL OR NOT EXISTS(
        SELECT 1 FROM incidents_automaticincidentorigin a JOIN lab_receptiondiscrepancy d ON d.id=NEW.discrepancy_id
        JOIN incidents_incident i ON i.id=NEW.incident_id JOIN ovitraps_bag b ON b.id=d.bag_id
        JOIN ovitraps_ovitrapreading r ON r.id=b.reading_id JOIN ovitraps_ovitrap o ON o.id=r.ovitrap_id
        JOIN geography_samplingpoint p ON p.id=o.sampling_point_id JOIN geography_block bl ON bl.id=p.block_id
        JOIN geography_quadrant q ON q.id=bl.quadrant_id JOIN lab_receptionincidentpolicyversion policy ON policy.id=NEW.policy_id
        WHERE a.incident_id=i.id AND a.source_kind='lab_reception' AND a.source_id=d.id
          AND i.center_id=q.center_id AND i.quadrant_id=q.id AND i.source_event_id IS NULL
          AND i.type_version_id=CASE WHEN d.kind='missing' THEN policy.missing_type_version_id ELSE policy.no_reading_type_version_id END)
        THEN RAISE EXCEPTION 'Lab incident link must retain its real source and policy'; END IF;
    ELSIF TG_TABLE_NAME='lab_labmethodverification' THEN
      PERFORM 1 FROM lab_labmethodversion WHERE id=NEW.method_version_id FOR NO KEY UPDATE NOWAIT;
      SELECT COALESCE(MAX(revision),0)+1 INTO expected_revision FROM lab_labmethodverification WHERE method_version_id=NEW.method_version_id;
      IF NEW.revision<>expected_revision OR NEW.decision NOT IN ('verify','withdraw')
        OR NOT EXISTS(SELECT 1 FROM lab_labmethodversion v WHERE v.id=NEW.method_version_id
          AND v.content_hash=NEW.content_hash AND btrim(v.procedure)<>'' AND btrim(v.reference)<>'')
        THEN RAISE EXCEPTION 'Lab verification requires an exact named procedure'; END IF;
    ELSIF TG_TABLE_NAME IN ('lab_eggcountattempt','lab_labrejection') THEN
      SELECT CASE WHEN c.action IN ('count','reject') THEN c.canonical_input ELSE c.canonical_input->'replacement' END INTO metadata
        FROM lab_labcommand c JOIN lab_bagreceipt p ON p.id=NEW.receipt_id
        WHERE c.id=NEW.command_id AND c.created_by_id=NEW.created_by_id AND c.source_id=p.source_id
          AND ((c.action IN ('count','reject') AND c.target_id=NEW.bag_id) OR c.action IN ('void_count','void_rejection'));
      IF metadata IS NULL THEN RAISE EXCEPTION 'Lab result must retain its actual authored command'; END IF;
      IF NOT EXISTS(SELECT 1 FROM lab_bagreceipt p JOIN ovitraps_bag b ON b.id=p.bag_id
        JOIN ovitraps_ovitrapreading r ON r.id=b.reading_id JOIN field_sync_fieldevent e ON e.id=r.event_id WHERE p.id=NEW.receipt_id
          AND p.kind='bag' AND b.id=NEW.bag_id AND r.paddle_present AND lab_effective_source(r.event_id)
          AND NEW.source_proof->>'reading_id'=r.id::text
          AND NEW.source_proof->>'source_event_id'=r.event_id::text
          AND NEW.source_proof->'has_eggs'=to_jsonb(r.has_eggs)
          AND NEW.source_proof->>'payload_sha256'=e.payload_sha256
          AND (NEW.source_proof->>'device_time')::timestamptz=e.device_time
          AND (NEW.source_proof->>'server_received_at')::timestamptz=e.server_received_at
          AND NEW.source_proof->>'source_rules_version'=e.rules_version
          AND NEW.source_proof->>'source_catalog_version'=e.catalog_version)
        THEN RAISE EXCEPTION 'Lab result requires its effective received real paddle'; END IF;
      IF NEW.method_version_id IS NOT NULL THEN
        PERFORM 1 FROM lab_labmethodversion WHERE id=NEW.method_version_id FOR NO KEY UPDATE NOWAIT;
        SELECT * INTO verification FROM lab_labmethodverification WHERE method_version_id=NEW.method_version_id ORDER BY revision DESC LIMIT 1;
        IF verification.id IS DISTINCT FROM NEW.verification_id OR verification.decision<>'verify'
          OR NOT EXISTS(SELECT 1 FROM lab_labmethodversion v WHERE v.id=NEW.method_version_id
            AND v.content_hash=verification.content_hash AND v.effective_from<=NEW.created_at
            AND v.id=(SELECT current_version.id FROM lab_labmethodversion current_version
              WHERE current_version.method_id=v.method_id AND current_version.effective_from<=NEW.created_at
              ORDER BY current_version.effective_from DESC,current_version.revision DESC LIMIT 1)
            AND (CASE WHEN TG_TABLE_NAME='lab_eggcountattempt' THEN v.supports_viability ELSE v.supports_rejection END))
          THEN RAISE EXCEPTION 'Lab method verification unavailable'; END IF;
      END IF;
      IF TG_TABLE_NAME='lab_eggcountattempt' THEN
        IF (metadata->>'value')::numeric IS DISTINCT FROM NEW.value
          OR metadata->>'method_version' IS DISTINCT FROM NEW.method_version_id::text
          OR (metadata->>'viable_eggs')::numeric IS DISTINCT FROM NEW.viable_eggs
          OR (metadata->>'total_examined')::numeric IS DISTINCT FROM NEW.total_examined
          THEN RAISE EXCEPTION 'Lab count differs from the exact submitted facts'; END IF;
        IF NOT COALESCE(lab_rules_are_pinned(NEW.organization_id,NEW.rules),false)
          OR jsonb_typeof(NEW.source_proof->'has_eggs')<>'boolean'
          THEN RAISE EXCEPTION 'Lab count requires actual policy and Boolean field proof'; END IF;
        IF NEW.total_examined>0 AND NEW.viability_percent IS DISTINCT FROM round(100*NEW.viable_eggs::numeric/NEW.total_examined,6)
          THEN RAISE EXCEPTION 'Lab ratio does not preserve examined facts'; END IF;
        IF NEW.value>(NEW.rules->'lab_count_plausibility_limit'->>'value')::bigint
          AND metadata->'confirmed_implausible' IS DISTINCT FROM 'true'::jsonb
          THEN RAISE EXCEPTION 'Lab implausible observation requires explicit confirmation'; END IF;
      ELSE
        IF metadata->>'method_version' IS DISTINCT FROM NEW.method_version_id::text
          OR metadata->>'reason' IS DISTINCT FROM NEW.reason OR NOT metadata->'evidence_ids' @> NEW.evidence_ids
          OR NOT NEW.evidence_ids @> metadata->'evidence_ids'
          THEN RAISE EXCEPTION 'Lab rejection differs from exact submitted facts'; END IF;
      END IF;
    ELSIF TG_TABLE_NAME='lab_labresultvoid' THEN
      IF length(NEW.reason)>1000 OR length(btrim(NEW.reason))<10 OR btrim(NEW.reason_code)=''
        THEN RAISE EXCEPTION 'Lab void needs a retained reason and note'; END IF;
    ELSIF TG_TABLE_NAME='lab_labresultrevision' THEN
      PERFORM 1 FROM ovitraps_bag WHERE id=NEW.bag_id FOR NO KEY UPDATE NOWAIT;
      SELECT * INTO verification FROM lab_labresultrevision WHERE bag_id=NEW.bag_id ORDER BY revision DESC LIMIT 1;
      IF NEW.revision<>COALESCE(verification.revision,0)+1 OR NEW.previous_id IS DISTINCT FROM verification.id
        THEN RAISE EXCEPTION 'Lab result revision fork'; END IF;
      IF NEW.count_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lab_eggcountattempt c WHERE c.id=NEW.count_id
        AND c.bag_id=NEW.bag_id AND c.command_id=NEW.command_id) THEN RAISE EXCEPTION 'Lab count chain mismatch'; END IF;
      IF NEW.rejection_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lab_labrejection r WHERE r.id=NEW.rejection_id
        AND r.bag_id=NEW.bag_id AND r.command_id=NEW.command_id) THEN RAISE EXCEPTION 'Lab rejection chain mismatch'; END IF;
      IF verification.count_id IS NOT NULL OR verification.rejection_id IS NOT NULL THEN
        IF NEW.void_id IS NULL OR NOT EXISTS(SELECT 1 FROM lab_labresultvoid v WHERE v.id=NEW.void_id
          AND v.command_id=NEW.command_id AND v.count_id IS NOT DISTINCT FROM verification.count_id
          AND v.rejection_id IS NOT DISTINCT FROM verification.rejection_id)
          THEN RAISE EXCEPTION 'Lab correction must retain its exact predecessor void'; END IF;
      ELSIF NEW.void_id IS NOT NULL THEN RAISE EXCEPTION 'Lab void lacks a current predecessor'; END IF;
    ELSIF TG_TABLE_NAME='lab_recountrequest' THEN
      IF NOT NEW.independent_required OR NOT EXISTS(SELECT 1 FROM lab_eggcountattempt c WHERE c.id=NEW.count_id
        AND c.created_by_id=NEW.first_counter_id) THEN RAISE EXCEPTION 'Independent request source mismatch'; END IF;
    ELSIF TG_TABLE_NAME='lab_recountrequestcause' THEN
      IF NEW.kind NOT IN ('implausible','eggs_flag_absent','daily_sample','carried_obligation')
        THEN RAISE EXCEPTION 'Unknown Lab independent-request cause'; END IF;
      IF NEW.kind='implausible' AND NOT EXISTS(SELECT 1 FROM lab_recountrequest q JOIN lab_eggcountattempt c ON c.id=q.count_id
        WHERE q.id=NEW.request_id AND c.value>(c.rules->'lab_count_plausibility_limit'->>'value')::bigint)
        THEN RAISE EXCEPTION 'Implausible cause must be the actual count policy result'; END IF;
      IF NEW.kind='eggs_flag_absent' AND NOT EXISTS(SELECT 1 FROM lab_recountrequest q JOIN lab_eggcountattempt c ON c.id=q.count_id
        WHERE q.id=NEW.request_id AND c.value>0 AND (c.source_proof->>'has_eggs')::boolean=false)
        THEN RAISE EXCEPTION 'Eggs-absent cause must preserve the actual field flag'; END IF;
      IF NEW.kind='daily_sample' AND NOT EXISTS(SELECT 1 FROM lab_dailyrecountsamplemember m
        JOIN lab_recountrequest q ON q.count_id=m.count_id WHERE q.id=NEW.request_id
          AND m.sample_id=(NEW.proof->>'sample_id')::uuid AND m.selected)
        THEN RAISE EXCEPTION 'Daily request lacks its real selected sample'; END IF;
      IF NEW.kind='carried_obligation' AND (jsonb_typeof(NEW.proof->'predecessor_request_ids')<>'array'
        OR jsonb_array_length(NEW.proof->'predecessor_request_ids')=0)
        THEN RAISE EXCEPTION 'Carried request lacks predecessor proof'; END IF;
      IF NEW.kind='carried_obligation' THEN
        FOR metadata IN SELECT value FROM jsonb_array_elements(NEW.proof->'predecessor_request_ids') LOOP
          IF NOT EXISTS(SELECT 1 FROM lab_recountrequest prior JOIN lab_eggcountattempt original ON original.id=prior.count_id
            JOIN lab_recountrequest successor ON successor.id=NEW.request_id
            JOIN lab_eggcountattempt replacement ON replacement.id=successor.count_id
            JOIN lab_labresultvoid v ON v.count_id=original.id WHERE prior.id=(metadata#>>'{}')::uuid
              AND original.bag_id=replacement.bag_id AND original.id<>replacement.id)
            THEN RAISE EXCEPTION 'Carried request must preserve its actual same-Bag voided predecessor'; END IF;
        END LOOP;
      END IF;
    ELSIF TG_TABLE_NAME='lab_recountrequestsupersession' THEN
      IF NOT EXISTS(SELECT 1 FROM lab_recountrequest q JOIN lab_eggcountattempt c ON c.id=q.count_id
        JOIN lab_labresultvoid v ON v.count_id=c.id WHERE q.id=NEW.request_id AND v.id=NEW.void_id)
        THEN RAISE EXCEPTION 'QA supersession loses original count'; END IF;
      IF NEW.replacement_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lab_recountrequest q
        JOIN lab_eggcountattempt c ON c.id=q.count_id JOIN lab_labresultrevision r ON r.count_id=c.id
        WHERE q.id=NEW.replacement_id AND r.void_id=NEW.void_id)
        THEN RAISE EXCEPTION 'QA replacement is not the actual correction'; END IF;
    ELSIF TG_TABLE_NAME='lab_dailyrecountsample' THEN
      SELECT COALESCE(MAX(revision),0)+1 INTO expected_revision FROM lab_dailyrecountsample
        WHERE organization_id=NEW.organization_id AND local_day=NEW.local_day;
      IF NEW.revision<>expected_revision OR NEW.actor_kind<>'system'
        OR NOT COALESCE(lab_rules_are_pinned(NEW.organization_id,NEW.rules),false)
        OR NEW.utc_from IS DISTINCT FROM (NEW.local_day::timestamp AT TIME ZONE NEW.timezone)
        OR NEW.utc_before IS DISTINCT FROM ((NEW.local_day+1)::timestamp AT TIME ZONE NEW.timezone)
        OR NEW.utc_before>NEW.created_at OR NEW.quota<>ceil(NEW.population::numeric*(NEW.rules->'lab_recount_sample_per_100'->>'value')::numeric/100)
        THEN RAISE EXCEPTION 'Closed Lab draw requires its real local-day frame and quota'; END IF;
    ELSIF TG_TABLE_NAME='lab_dailyrecountsamplemember' THEN
      IF NOT EXISTS(SELECT 1 FROM lab_dailyrecountsample s JOIN lab_eggcountattempt c ON c.id=NEW.count_id
        WHERE s.id=NEW.sample_id AND c.created_at>=s.utc_from AND c.created_at<s.utc_before
          AND c.id=(SELECT r.count_id FROM lab_labresultrevision r WHERE r.bag_id=c.bag_id ORDER BY r.revision DESC LIMIT 1)
          AND lab_effective_source((c.source_proof->>'source_event_id')::uuid))
        THEN RAISE EXCEPTION 'Daily sample member is not in its real current first-pass population'; END IF;
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION lab_complete_guard() RETURNS trigger AS $$
DECLARE observed integer; required integer; entry record;
BEGIN
    -- Select the table before a separate statement binds its specific NEW fields.
    IF TG_TABLE_NAME='lab_labcommand' THEN
      IF NOT EXISTS(SELECT 1 FROM lab_labcommandresult r WHERE r.command_id=NEW.id)
        THEN RAISE EXCEPTION 'Lab command must commit its exact result'; END IF;
    END IF;
    IF TG_TABLE_NAME='lab_labcommandresult' THEN
      IF NEW.status IN (200,201) THEN
        IF NOT EXISTS(SELECT 1 FROM lab_labcommand c WHERE c.id=NEW.command_id AND
        ((c.action IN ('receive','receive_reading') AND EXISTS(SELECT 1 FROM lab_bagreceipt p WHERE p.command_id=c.id AND p.created_by_id=c.created_by_id))
        OR (c.action='count' AND EXISTS(SELECT 1 FROM lab_eggcountattempt p WHERE p.command_id=c.id AND p.bag_id=c.target_id AND p.created_by_id=c.created_by_id))
        OR (c.action='reject' AND EXISTS(SELECT 1 FROM lab_labrejection p WHERE p.command_id=c.id AND p.bag_id=c.target_id AND p.created_by_id=c.created_by_id))
        OR (c.action IN ('void_count','void_rejection') AND EXISTS(SELECT 1 FROM lab_labresultvoid p WHERE p.command_id=c.id AND c.target_id IN (p.count_id,p.rejection_id) AND p.created_by_id=c.created_by_id))))
          THEN RAISE EXCEPTION 'Successful Lab command must retain its exact authored effect'; END IF;
      END IF;
    END IF;
    IF TG_TABLE_NAME IN ('lab_eggcountattempt','lab_labrejection','lab_labresultvoid') THEN
      IF NOT EXISTS(SELECT 1 FROM lab_labresultrevision r WHERE r.command_id=NEW.command_id
        AND (CASE WHEN TG_TABLE_NAME='lab_eggcountattempt' THEN r.count_id=NEW.id
          WHEN TG_TABLE_NAME='lab_labrejection' THEN r.rejection_id=NEW.id ELSE r.void_id=NEW.id END))
        THEN RAISE EXCEPTION 'Lab fact must commit in its result revision'; END IF;
    END IF;
    IF TG_TABLE_NAME='lab_eggcountattempt' THEN
      IF NEW.value>(NEW.rules->'lab_count_plausibility_limit'->>'value')::bigint
        AND NOT EXISTS(SELECT 1 FROM lab_recountrequest q JOIN lab_recountrequestcause c ON c.request_id=q.id
          WHERE q.count_id=NEW.id AND c.kind='implausible') THEN RAISE EXCEPTION 'Implausible count needs a real request'; END IF;
      IF NEW.value>0 AND NOT (NEW.source_proof->>'has_eggs')::boolean
        AND NOT EXISTS(SELECT 1 FROM lab_recountrequest q JOIN lab_recountrequestcause c ON c.request_id=q.id
          WHERE q.count_id=NEW.id AND c.kind='eggs_flag_absent') THEN RAISE EXCEPTION 'Eggs-absent count needs a real request'; END IF;
    ELSIF TG_TABLE_NAME='lab_labrejection' THEN
      IF jsonb_typeof(NEW.evidence_ids)<>'array' OR jsonb_array_length(NEW.evidence_ids)=0
        THEN RAISE EXCEPTION 'Rejection needs actual evidence'; END IF;
      FOR entry IN SELECT value #>> '{}' AS identifier FROM jsonb_array_elements(NEW.evidence_ids) LOOP
        IF NOT EXISTS(SELECT 1 FROM uploads_upload u JOIN uploads_uploadverification v ON v.upload_id=u.id
          JOIN uploads_attachmentlink l ON l.upload_id=u.id WHERE u.public_id=entry.identifier::uuid
          AND u.organization_id=NEW.organization_id AND u.uploader_id=NEW.created_by_id AND l.lab_rejection_id=NEW.id)
          THEN RAISE EXCEPTION 'Rejection evidence is not its verified exact parent'; END IF;
      END LOOP;
    ELSIF TG_TABLE_NAME='lab_recountrequest' THEN
      IF NOT EXISTS(SELECT 1 FROM lab_recountrequestcause c WHERE c.request_id=NEW.id)
        THEN RAISE EXCEPTION 'Recount request must retain a real cause'; END IF;
    ELSIF TG_TABLE_NAME='lab_dailyrecountsample' THEN
      SELECT count(*) INTO observed FROM lab_eggcountattempt c WHERE c.organization_id=NEW.organization_id
        AND c.created_at>=NEW.utc_from AND c.created_at<NEW.utc_before
        AND lab_effective_source((c.source_proof->>'source_event_id')::uuid)
        AND c.id=(SELECT r.count_id FROM lab_labresultrevision r WHERE r.bag_id=c.bag_id ORDER BY revision DESC LIMIT 1);
      IF observed<>NEW.population THEN RAISE EXCEPTION 'Daily frame must retain its complete real population'; END IF;
      SELECT count(*),count(*) FILTER(WHERE selected) INTO observed,required FROM lab_dailyrecountsamplemember WHERE sample_id=NEW.id;
      IF observed<>NEW.population OR required<NEW.quota THEN RAISE EXCEPTION 'Daily sample incomplete'; END IF;
      IF EXISTS(SELECT 1 FROM lab_dailyrecountsamplemember m WHERE m.sample_id=NEW.id AND m.selected
        AND NOT EXISTS(SELECT 1 FROM lab_recountrequest q JOIN lab_recountrequestcause c ON c.request_id=q.id
          WHERE q.count_id=m.count_id AND c.kind='daily_sample'))
        THEN RAISE EXCEPTION 'Selected daily member requires its actual independent request'; END IF;
      IF EXISTS(SELECT 1 FROM lab_dailyrecountsamplemember current_member
        JOIN lab_dailyrecountsamplemember old_member ON old_member.count_id=current_member.count_id AND old_member.selected
        JOIN lab_dailyrecountsample prior ON prior.id=old_member.sample_id
        WHERE current_member.sample_id=NEW.id AND NOT current_member.selected AND prior.organization_id=NEW.organization_id
          AND prior.local_day=NEW.local_day AND prior.revision<NEW.revision)
        THEN RAISE EXCEPTION 'Daily supplement cannot erase an earlier selected obligation'; END IF;
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION lab_source_void_guard() RETURNS trigger AS $$
BEGIN
    IF OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL AND EXISTS(
      SELECT 1 FROM ovitraps_bag b JOIN LATERAL(SELECT r.count_id,r.rejection_id FROM lab_labresultrevision r
        WHERE r.bag_id=b.id ORDER BY revision DESC LIMIT 1) current ON true
      WHERE b.event_id=NEW.id AND (current.count_id IS NOT NULL OR current.rejection_id IS NOT NULL))
      THEN RAISE EXCEPTION 'Source void must preserve active Lab dependents'
        USING ERRCODE='23514', CONSTRAINT='lab_source_void_active', DETAIL=NEW.id::text; END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER lab_source_void_guard AFTER UPDATE ON field_sync_fieldevent
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lab_source_void_guard();

CREATE FUNCTION lab_attachment_guard() RETURNS trigger AS $$
BEGIN
    IF NEW.lab_rejection_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lab_labrejection r
      JOIN uploads_upload u ON u.id=NEW.upload_id JOIN uploads_uploadverification v ON v.upload_id=u.id
      WHERE r.id=NEW.lab_rejection_id AND r.organization_id=NEW.organization_id
        AND u.organization_id=NEW.organization_id AND u.uploader_id=r.created_by_id
        AND r.evidence_ids @> jsonb_build_array(u.public_id::text))
      THEN RAISE EXCEPTION 'Lab attachment source or tenant mismatch'; END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER lab_attachment_guard BEFORE INSERT ON uploads_attachmentlink
  FOR EACH ROW EXECUTE FUNCTION lab_attachment_guard();

CREATE FUNCTION lab_origin_guard() RETURNS trigger AS $$
BEGIN
    IF NEW.source_kind='lab_reception' AND NOT EXISTS(SELECT 1 FROM lab_receptiondiscrepancy d
      JOIN incidents_incident i ON i.id=NEW.incident_id WHERE d.id=NEW.source_id
        AND d.organization_id=NEW.organization_id AND i.organization_id=NEW.organization_id
        AND NEW.actor_kind='system' AND NEW.created_by_id IS NULL)
      THEN RAISE EXCEPTION 'Lab automatic origin requires a real discrepancy'; END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER lab_origin_guard BEFORE INSERT ON incidents_automaticincidentorigin
  FOR EACH ROW EXECUTE FUNCTION lab_origin_guard();
"""


def protect_reverse(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        for table in TABLES:
            cursor.execute(f'SELECT EXISTS(SELECT 1 FROM "{table}")')
            if cursor.fetchone()[0]:
                raise IrreversibleError("Retain Lab audit facts; use a forward correction.")
        cursor.execute("SELECT EXISTS(SELECT 1 FROM uploads_attachmentlink WHERE lab_rejection_id IS NOT NULL) OR EXISTS(SELECT 1 FROM incidents_automaticincidentorigin WHERE source_kind='lab_reception') OR EXISTS(SELECT 1 FROM reviews_historypublicationreceipt WHERE cause_kind LIKE 'lab_%')")
        if cursor.fetchone()[0]:
            raise IrreversibleError("Retain Lab evidence/origins/history receipts.")


def guards():
    return "\n".join(
        f'CREATE TRIGGER {table}_guard BEFORE UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION lab_insert_only_guard();\n'
        f'CREATE TRIGGER {table}_insert_guard BEFORE INSERT ON {table} FOR EACH ROW EXECUTE FUNCTION lab_insert_guard();\n'
        f'CREATE CONSTRAINT TRIGGER {table}_complete_guard AFTER INSERT ON {table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lab_complete_guard();'
        for table in TABLES
    )


def reverse_guards():
    tables = "\n".join(f'DROP TRIGGER {table}_complete_guard ON {table}; DROP TRIGGER {table}_insert_guard ON {table}; DROP TRIGGER {table}_guard ON {table};' for table in reversed(TABLES))
    return tables + """
DROP TRIGGER lab_origin_guard ON incidents_automaticincidentorigin;
DROP TRIGGER lab_attachment_guard ON uploads_attachmentlink;
DROP TRIGGER lab_source_void_guard ON field_sync_fieldevent;
DROP FUNCTION lab_origin_guard(); DROP FUNCTION lab_attachment_guard(); DROP FUNCTION lab_source_void_guard();
DROP FUNCTION lab_complete_guard(); DROP FUNCTION lab_insert_guard(); DROP FUNCTION lab_insert_only_guard(); DROP FUNCTION lab_rules_are_pinned(uuid,jsonb); DROP FUNCTION lab_effective_source(uuid);
"""


class Migration(migrations.Migration):
    dependencies = [
        ("lab", "0001_initial"),
        ("uploads", "0005_remove_attachmentlink_attachment_exactly_one_parent_and_more"),
        ("incidents", "0003_alter_automaticincidentorigin_source_kind"),
        ("reviews", "0004_transfer_source_dependency"),
        ("rules", "0004_void_reason_code"),
    ]
    operations = [
        migrations.RunSQL(FUNCTIONS + guards(), reverse_guards()),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
