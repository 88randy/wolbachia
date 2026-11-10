"""Forward blindness, real independent observations and physical material completion.

Extend the original insert/result functions only at their closed new-action
boundaries. Old audit rows, commands, hashes and trigger identities are untouched.
"""

from importlib import import_module

from django.apps.registry import Apps
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.exceptions import IrreversibleError

PRIOR = import_module("lab.migrations.0002_append_only_guards")
MATERIAL_PRIOR = import_module("lab.migrations.0003_material_disposition_guard")
TABLES = (
    "labqapolicyversion",
    "labblindobservation",
    "labnumericdisclosure",
    "recountindependenceattestation",
    "recountclaim",
    "recountattempt",
    "recountresolution",
    "recountrevision",
    "eggpaddle",
    "paddlebagbinding",
    "paddlereuse",
)


def original_function(name: str) -> str:
    body = PRIOR.FUNCTIONS.split("CREATE FUNCTION " + name, 1)[1].split("$$ LANGUAGE plpgsql;", 1)[
        0
    ]
    return "CREATE OR REPLACE FUNCTION " + name + body + "$$ LANGUAGE plpgsql;"


OLD_INSERT = original_function("lab_insert_guard()")
OLD_COMPLETE = original_function("lab_complete_guard()")
SOURCE_CHECK = "IF NOT EXISTS(SELECT 1 FROM field_sync_fieldevent e WHERE e.id=NEW.source_id\n        AND e.organization_id=NEW.organization_id)"
if OLD_INSERT.count(SOURCE_CHECK) != 1:
    raise RuntimeError("The released command source guard must have one exact extension anchor")
NEW_INSERT = OLD_INSERT.replace(
    SOURCE_CHECK,
    "IF NOT ((NEW.action='paddle_register' AND NEW.source_id IS NULL) OR EXISTS(SELECT 1 FROM field_sync_fieldevent e WHERE e.id=NEW.source_id AND e.organization_id=NEW.organization_id))",
)
SUBJECT_START = "      FOR metadata IN SELECT value FROM jsonb_array_elements(NEW.subjects) LOOP"
SUBJECT_END = "      END LOOP;"
old_subjects = NEW_INSERT.split(SUBJECT_START, 1)[1].split(SUBJECT_END, 1)[0]
NEW_INSERT = NEW_INSERT.replace(
    SUBJECT_START + old_subjects + SUBJECT_END,
    r"""
      FOR metadata IN SELECT value FROM jsonb_array_elements(NEW.subjects) LOOP
        IF jsonb_typeof(metadata) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Lab result subject invalid'; END IF;
        IF metadata ? 'contexts' THEN
          IF NOT EXISTS(SELECT 1 FROM lab_labcommand c WHERE c.id=NEW.command_id AND c.action IN ('paddle_register','paddle_bind','paddle_reuse'))
            OR metadata->>'permission' IS NULL OR metadata->>'permission' NOT IN ('egg_paddle.reuse','field.upload','inventory.reconcile')
            OR jsonb_typeof(metadata->'contexts') IS DISTINCT FROM 'array' OR jsonb_array_length(metadata->'contexts')=0
            OR EXISTS(SELECT 1 FROM jsonb_array_elements(metadata->'contexts') context WHERE
              NOT EXISTS(SELECT 1 FROM organizations_center center WHERE center.id=(context->>'center_id')::uuid
                AND center.organization_id=NEW.organization_id)
              OR ((context->>'quadrant_id') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM geography_quadrant quadrant
                WHERE quadrant.id=(context->>'quadrant_id')::uuid AND quadrant.center_id=(context->>'center_id')::uuid
                AND quadrant.organization_id=NEW.organization_id)))
            THEN RAISE EXCEPTION 'Lab physical result subject invalid'; END IF;
        ELSE
          IF NOT EXISTS(SELECT 1 FROM ovitraps_ovitrapreading r WHERE r.id=(metadata->>'reading_id')::uuid AND r.organization_id=NEW.organization_id)
            THEN RAISE EXCEPTION 'Lab result subject invalid'; END IF;
          IF metadata ? 'permissions_any' THEN
            IF metadata->'permissions_any' IS DISTINCT FROM '["recount.create","recount.adjudicate"]'::jsonb
              THEN RAISE EXCEPTION 'Lab alternative action subject invalid'; END IF;
          ELSIF metadata->>'permission' IS NULL OR metadata->>'permission' NOT IN
            ('bag.receive','egg_count.create','egg_count.void','lab_rejection.create','field.upload','egg_count.read','recount.create','recount.adjudicate')
            THEN RAISE EXCEPTION 'Lab result subject invalid'; END IF;
          IF metadata ? 'user_id' AND NOT EXISTS(SELECT 1 FROM organizations_membership m
            JOIN lab_labcommand c ON c.id=NEW.command_id WHERE c.action='recount_attest'
            AND m.organization_id=NEW.organization_id AND m.user_id=(metadata->>'user_id')::uuid
            AND c.canonical_input->>'counter_id'=m.user_id::text)
            THEN RAISE EXCEPTION 'Lab result participant invalid'; END IF;
        END IF;
      END LOOP;""",
)
SUCCESS = "IF NEW.status IN (200,201) THEN"
if OLD_COMPLETE.count(SUCCESS) != 1:
    raise RuntimeError("The released completion guard must have one exact extension anchor")
NEW_COMPLETE = OLD_COMPLETE.replace(
    SUCCESS,
    SUCCESS.replace(
        " THEN",
        " AND NOT EXISTS(SELECT 1 FROM lab_labcommand c WHERE c.id=NEW.command_id AND c.action IN ('recount_claim','recount','recount_adjudicate','recount_attest','paddle_register','paddle_bind','paddle_reuse')) THEN",
    ),
)
OLD_SOURCE = MATERIAL_PRIOR.NEW_SOURCE
SOURCE_PREFIX = """BEGIN
 IF OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL THEN
   IF EXISTS(SELECT 1 FROM lab_paddlebagbinding binding JOIN ovitraps_bag bag ON bag.id=binding.bag_id
     JOIN ovitraps_ovitrapreading reading ON reading.id=bag.reading_id JOIN ovitraps_ovitrap ovitrap ON ovitrap.id=reading.ovitrap_id
     WHERE binding.source_id=NEW.id OR ovitrap.event_id=NEW.id) THEN
     RAISE EXCEPTION 'Source void must preserve actual physical paddle dependencies'
       USING ERRCODE='23514',CONSTRAINT='lab_source_void_active',DETAIL=NEW.id::text;
   END IF;
 END IF;
"""
if OLD_SOURCE.count("BEGIN") != 1:
    raise RuntimeError("The released source-void function must have one exact body boundary")
NEW_SOURCE = OLD_SOURCE.replace("BEGIN", SOURCE_PREFIX, 1)

HELPERS = r"""
CREATE FUNCTION lab_qa_cause_ids(request_uuid uuid) RETURNS jsonb AS $$
 SELECT COALESCE(jsonb_agg(id::text ORDER BY id),'[]'::jsonb) FROM lab_recountrequestcause WHERE request_id=request_uuid;
$$ LANGUAGE sql;

CREATE FUNCTION lab_qa_method_valid(tenant uuid, method_uuid uuid, verification_uuid uuid, capability text, at_time timestamptz)
RETURNS boolean AS $$
 SELECT EXISTS(SELECT 1 FROM lab_labmethodversion method JOIN lab_labmethodverification proof ON proof.method_version_id=method.id
 WHERE method.id=method_uuid AND method.organization_id=tenant AND proof.id=verification_uuid
 AND proof.decision='verify' AND proof.content_hash=method.content_hash
 AND btrim(method.procedure)<>'' AND btrim(method.reference)<>''
 AND proof.revision=(SELECT MAX(revision) FROM lab_labmethodverification WHERE method_version_id=method.id)
 AND method.id=(SELECT v.id FROM lab_labmethodversion v WHERE v.method_id=method.method_id AND v.effective_from<=at_time ORDER BY v.effective_from DESC,v.revision DESC LIMIT 1)
 AND ((capability='independent_qa' AND method.supports_independent_qa) OR (capability='paddle_reuse' AND method.supports_paddle_reuse)));
$$ LANGUAGE sql;

CREATE FUNCTION lab_qa_request_frame(request_uuid uuid,result_uuid uuid) RETURNS boolean AS $$
 SELECT EXISTS(SELECT 1 FROM lab_recountrequest request JOIN lab_eggcountattempt first_count ON first_count.id=request.count_id
 JOIN lab_labresultrevision result ON result.id=result_uuid JOIN ovitraps_bag bag ON bag.id=first_count.bag_id
 WHERE request.id=request_uuid AND result.count_id=first_count.id AND result.bag_id=bag.id
 AND result.revision=(SELECT MAX(revision) FROM lab_labresultrevision WHERE bag_id=bag.id)
 AND NOT EXISTS(SELECT 1 FROM lab_recountrequestsupersession WHERE request_id=request.id)
 AND lab_effective_source(bag.event_id));
$$ LANGUAGE sql;

CREATE FUNCTION lab_qa_independent(request_uuid uuid,counter_uuid uuid,role_name text,result_uuid uuid) RETURNS boolean AS $$
 SELECT EXISTS(SELECT 1 FROM lab_recountrequest request JOIN lab_eggcountattempt first_count ON first_count.id=request.count_id
 WHERE request.id=request_uuid AND role_name IN ('second','third') AND request.first_counter_id<>counter_uuid
 AND NOT EXISTS(SELECT 1 FROM lab_eggcountattempt known WHERE known.bag_id=first_count.bag_id AND known.created_by_id=counter_uuid)
 AND NOT EXISTS(SELECT 1 FROM lab_labnumericdisclosure known JOIN lab_eggcountattempt observed ON observed.id=known.count_id
   WHERE observed.bag_id=first_count.bag_id AND known.created_by_id=counter_uuid)
 AND (role_name<>'third' OR NOT EXISTS(SELECT 1 FROM lab_recountattempt second_count WHERE second_count.request_id=request.id AND second_count.role='second' AND second_count.created_by_id=counter_uuid))
 AND (EXISTS(SELECT 1 FROM lab_labblindobservation WHERE count_id=first_count.id)
   OR EXISTS(SELECT 1 FROM lab_recountindependenceattestation attested WHERE attested.request_id=request.id
     AND attested.first_result_id=result_uuid AND attested.counter_id=counter_uuid AND attested.role=role_name
     AND attested.authority_proof->'cause_ids'=lab_qa_cause_ids(request.id)))
 AND EXISTS(SELECT 1 FROM accounts_user person JOIN organizations_membership member ON member.user_id=person.id
   WHERE person.id=counter_uuid AND person.is_active AND member.is_active AND member.organization_id=request.organization_id));
$$ LANGUAGE sql;

CREATE FUNCTION lab_qa_resolution_current(request_uuid uuid,result_uuid uuid) RETURNS boolean AS $$
 SELECT EXISTS(SELECT 1 FROM lab_recountresolution resolution WHERE resolution.request_id=request_uuid
 AND resolution.first_result_id=result_uuid AND lab_qa_request_frame(request_uuid,result_uuid)
 AND resolution.comparison_proof->'cause_ids'=lab_qa_cause_ids(request_uuid)
 AND resolution.id=(SELECT r.id FROM lab_recountresolution r JOIN lab_recountrevision v ON v.resolution_id=r.id
   WHERE r.request_id=request_uuid ORDER BY v.revision DESC LIMIT 1));
$$ LANGUAGE sql;

CREATE FUNCTION lab_paddle_issue_valid(movement_uuid uuid,bag_uuid uuid) RETURNS boolean AS $$
 SELECT EXISTS(SELECT 1 FROM inventory_stockmovement movement JOIN inventory_supplystockeffect effect ON effect.movement_id=movement.id
 JOIN inventory_supplyledgersource source ON source.id=effect.source_id JOIN inventory_supplyevent event ON event.id=source.event_id
 JOIN ovitraps_bag bag ON bag.id=bag_uuid JOIN ovitraps_ovitrapreading reading ON reading.id=bag.reading_id
 JOIN ovitraps_ovitrap ovitrap ON ovitrap.id=reading.ovitrap_id JOIN ovitraps_placementattempt placement ON placement.ovitrap_id=ovitrap.id
 JOIN inventory_supplyassignment assignment ON assignment.id=event.assignment_id
 WHERE movement.id=movement_uuid AND movement.organization_id=bag.organization_id AND movement.piece_id IS NOT NULL
 AND movement.assignment_id=assignment.id AND abs(movement.quantity)=1 AND effect.receipt_line_id IS NOT NULL
 AND movement.operation_id=(SELECT id FROM inventory_stockoperation WHERE supply_source_id=source.id)
 AND NOT EXISTS(SELECT 1 FROM inventory_supplyvoidaudit WHERE event_id=event.id)
 AND lab_effective_source(reading.event_id) AND lab_effective_source(ovitrap.event_id)
 AND ((movement.quantity=-1 AND effect.kind='used' AND EXISTS(SELECT 1 FROM inventory_supplyuse used
   WHERE used.event_id=event.id AND used.receipt_line_id=effect.receipt_line_id AND used.quantity=1
   AND used.work_kind='field_event' AND used.work_source_id IN (reading.event_id,ovitrap.event_id)))
 OR (movement.quantity=1 AND effect.kind='courier_credit' AND assignment.courier_id=(SELECT created_by_id FROM field_sync_fieldevent WHERE id=ovitrap.event_id)
   AND placement.supply_refs ? effect.receipt_line_id::text)));
$$ LANGUAGE sql;

CREATE FUNCTION lab_paddle_draw_current(member_uuid uuid,at_time timestamptz) RETURNS boolean AS $$
 WITH chosen_sample AS (
   SELECT sample.* FROM lab_dailyrecountsamplemember member JOIN lab_dailyrecountsample sample ON sample.id=member.sample_id
   WHERE member.id=member_uuid
 ), current_counts AS (
   SELECT count.id FROM lab_eggcountattempt count JOIN lab_bagreceipt receipt ON receipt.id=count.receipt_id
   JOIN ovitraps_ovitrapreading reading ON reading.id=receipt.reading_id CROSS JOIN chosen_sample sample
   WHERE count.organization_id=sample.organization_id AND count.created_at>=sample.utc_from AND count.created_at<sample.utc_before
   AND lab_effective_source(reading.event_id)
   AND count.id=(SELECT result.count_id FROM lab_labresultrevision result WHERE result.bag_id=count.bag_id ORDER BY result.revision DESC LIMIT 1)
 )
 SELECT EXISTS(SELECT 1 FROM chosen_sample sample JOIN organizations_organization organization ON organization.id=sample.organization_id
   WHERE sample.timezone=organization.timezone AND sample.rules->'organization_revision'=to_jsonb(organization.revision)
   AND sample.utc_from=(sample.local_day::timestamp AT TIME ZONE organization.timezone)
   AND sample.utc_before=((sample.local_day+1)::timestamp AT TIME ZONE organization.timezone) AND sample.utc_before<=at_time
   AND sample.revision=(SELECT MAX(revision) FROM lab_dailyrecountsample WHERE organization_id=sample.organization_id AND local_day=sample.local_day)
   AND sample.population=(SELECT count(*) FROM current_counts)
   AND sample.population=(SELECT count(*) FROM lab_dailyrecountsamplemember WHERE sample_id=sample.id)
   AND NOT EXISTS(SELECT 1 FROM lab_dailyrecountsamplemember member WHERE member.sample_id=sample.id
     AND NOT EXISTS(SELECT 1 FROM current_counts count WHERE count.id=member.count_id)));
$$ LANGUAGE sql;
"""

INSERT_GUARD = r"""
CREATE FUNCTION lab_qa_insert_guard() RETURNS trigger AS $$
DECLARE command lab_labcommand; request lab_recountrequest; first_count lab_eggcountattempt;
        claim lab_recountclaim; second_count lab_recountattempt; third_count lab_recountattempt;
        registered lab_eggpaddle; binding lab_paddlebagbinding; policy lab_labqapolicyversion;
        previous_uuid uuid; previous_revision integer; input jsonb; actual_value bigint; required_third boolean;
BEGIN
 IF TG_TABLE_NAME='lab_labqapolicyversion' THEN
   IF NEW.revision<>1+(SELECT COALESCE(MAX(revision),0) FROM lab_labqapolicyversion WHERE organization_id=NEW.organization_id)
     OR NEW.content_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'QA policy revision/proof invalid'; END IF;
 ELSIF TG_TABLE_NAME='lab_labblindobservation' THEN
   IF NEW.policy_version<>'lab.blind.v1' OR NOT EXISTS(SELECT 1 FROM lab_eggcountattempt count JOIN lab_labcommand c ON c.id=count.command_id
     WHERE count.id=NEW.count_id AND c.id=NEW.command_id AND c.action='count' AND count.ordinal=1 AND count.replacement_of_id IS NULL
     AND count.created_by_id=NEW.created_by_id AND c.organization_id=NEW.organization_id
     AND NOT EXISTS(SELECT 1 FROM lab_labcommandresult WHERE command_id=c.id))
     THEN RAISE EXCEPTION 'Blind boundary requires a genuinely new first observation before its saved result'; END IF;
 ELSIF TG_TABLE_NAME='lab_labnumericdisclosure' THEN
   IF NEW.surface NOT IN ('result','void_context','request','history','replay','physical_assessment') THEN RAISE EXCEPTION 'Numeric disclosure boundary invalid'; END IF;
 ELSIF TG_TABLE_NAME IN ('lab_recountclaim','lab_recountattempt','lab_recountresolution','lab_recountindependenceattestation') THEN
   SELECT * INTO command FROM lab_labcommand WHERE id=NEW.command_id;
   SELECT * INTO request FROM lab_recountrequest WHERE id=NEW.request_id;
   SELECT * INTO first_count FROM lab_eggcountattempt WHERE id=request.count_id;
   input=command.canonical_input;
   IF command.created_by_id IS DISTINCT FROM NEW.created_by_id OR command.organization_id IS DISTINCT FROM NEW.organization_id
     THEN RAISE EXCEPTION 'Independent fact requires its real authored command'; END IF;
   IF TG_TABLE_NAME='lab_recountattempt' THEN
     SELECT * INTO claim FROM lab_recountclaim WHERE id=NEW.claim_id;
     IF command.action<>'recount' OR command.target_id IS DISTINCT FROM NEW.bag_id OR input->>'request_id' IS DISTINCT FROM NEW.request_id::text
       OR claim.request_id IS DISTINCT FROM request.id OR claim.role IS DISTINCT FROM NEW.role OR claim.counter_id IS DISTINCT FROM NEW.created_by_id
       OR NEW.receipt_id IS DISTINCT FROM first_count.receipt_id OR NEW.bag_id IS DISTINCT FROM first_count.bag_id
       OR NOT COALESCE(lab_qa_request_frame(request.id,claim.first_result_id),false)
       OR NOT COALESCE(lab_qa_independent(request.id,NEW.created_by_id,NEW.role,claim.first_result_id),false)
       OR claim.independence_proof->'cause_ids' IS DISTINCT FROM lab_qa_cause_ids(request.id)
       OR claim.id IS DISTINCT FROM (SELECT c.id FROM lab_recountclaim c JOIN lab_recountrevision v ON v.claim_id=c.id
         WHERE c.request_id=request.id AND c.role=NEW.role ORDER BY v.revision DESC LIMIT 1)
       OR input->'value' IS DISTINCT FROM to_jsonb(NEW.value) OR input->>'method_version' IS DISTINCT FROM NEW.method_version_id::text
       OR NOT COALESCE(lab_qa_method_valid(NEW.organization_id,NEW.method_version_id,NEW.verification_id,'independent_qa',NEW.created_at),false)
       OR NOT EXISTS(SELECT 1 FROM lab_labqapolicyversion claim_policy WHERE claim_policy.id=claim.policy_id AND claim_policy.qa_method_version_id=NEW.method_version_id
         AND claim_policy.id=(SELECT id FROM lab_labqapolicyversion WHERE organization_id=NEW.organization_id ORDER BY revision DESC LIMIT 1))
       OR NOT COALESCE(lab_rules_are_pinned(NEW.organization_id,NEW.rules),false)
       OR NEW.source_proof->'first_source' IS DISTINCT FROM first_count.source_proof
       OR NEW.source_proof->'independence' IS DISTINCT FROM claim.independence_proof
       OR NEW.source_proof->>'first_result_id' IS DISTINCT FROM claim.first_result_id::text
       OR (input->>'expected_result_revision')::integer IS DISTINCT FROM (SELECT revision FROM lab_labresultrevision WHERE id=claim.first_result_id)
       OR input->'viable_eggs' IS DISTINCT FROM to_jsonb(NEW.viable_eggs)
         AND NOT (input->'viable_eggs' IS NULL AND NEW.viable_eggs IS NULL)
       OR input->'total_examined' IS DISTINCT FROM to_jsonb(NEW.total_examined)
         AND NOT (input->'total_examined' IS NULL AND NEW.total_examined IS NULL)
       OR (NEW.value>(NEW.rules->'lab_count_plausibility_limit'->>'value')::bigint AND input->'confirmed_implausible' IS DISTINCT FROM 'true'::jsonb)
       THEN RAISE EXCEPTION 'Independent observation source, claim, method or blindness invalid'; END IF;
     IF NEW.total_examined>0 THEN
       IF NEW.viability_percent IS DISTINCT FROM round(100*NEW.viable_eggs::numeric/NEW.total_examined,6)
         THEN RAISE EXCEPTION 'Independent measured ratio invalid'; END IF;
     END IF;
   ELSE
     IF command.target_id IS DISTINCT FROM request.id OR NOT COALESCE(lab_qa_request_frame(request.id,NEW.first_result_id),false)
       THEN RAISE EXCEPTION 'Independent command current first/result frame invalid'; END IF;
     IF TG_TABLE_NAME='lab_recountclaim' THEN
       SELECT * INTO policy FROM lab_labqapolicyversion WHERE id=NEW.policy_id;
       SELECT c.id INTO previous_uuid FROM lab_recountclaim c JOIN lab_recountrevision v ON v.claim_id=c.id
         WHERE c.request_id=request.id AND c.role=NEW.role ORDER BY v.revision DESC LIMIT 1;
       IF command.action<>'recount_claim' OR NEW.created_by_id IS DISTINCT FROM NEW.counter_id OR input->>'role' IS DISTINCT FROM NEW.role
         OR NEW.previous_id IS DISTINCT FROM previous_uuid OR NOT COALESCE(lab_qa_independent(request.id,NEW.counter_id,NEW.role,NEW.first_result_id),false)
         OR NEW.independence_proof->'cause_ids' IS DISTINCT FROM lab_qa_cause_ids(request.id)
         OR NEW.independence_proof->>'policy' IS DISTINCT FROM 'lab.blind.v1'
         OR NEW.independence_proof->>'first_count_id' IS DISTINCT FROM request.count_id::text
         OR NEW.independence_proof->>'first_result_id' IS DISTINCT FROM NEW.first_result_id::text
         OR NEW.independence_proof->>'counter_id' IS DISTINCT FROM NEW.counter_id::text
         OR NEW.independence_proof->>'role' IS DISTINCT FROM NEW.role
         OR (NOT EXISTS(SELECT 1 FROM lab_labblindobservation boundary WHERE boundary.count_id=request.count_id
               AND NEW.independence_proof->>'boundary_id'=boundary.id::text)
           AND NOT EXISTS(SELECT 1 FROM lab_recountindependenceattestation attestation WHERE attestation.request_id=request.id
               AND attestation.first_result_id=NEW.first_result_id AND attestation.counter_id=NEW.counter_id AND attestation.role=NEW.role
               AND attestation.authority_proof->'cause_ids'=lab_qa_cause_ids(request.id)
               AND NEW.independence_proof->>'attestation_id'=attestation.id::text))
         OR (NEW.role='third' AND NOT EXISTS(SELECT 1 FROM lab_recountattempt second_observation JOIN lab_recountclaim second_claim ON second_claim.id=second_observation.claim_id
           JOIN lab_labqapolicyversion second_policy ON second_policy.id=second_claim.policy_id WHERE second_observation.request_id=request.id AND second_observation.role='second'
           AND abs(first_count.value-second_observation.value)*100>greatest(second_policy.absolute_tolerance*100,second_policy.relative_per_100*first_count.value)))
         OR policy.id IS DISTINCT FROM (SELECT id FROM lab_labqapolicyversion WHERE organization_id=NEW.organization_id ORDER BY revision DESC LIMIT 1)
         OR NOT EXISTS(SELECT 1 FROM lab_labmethodverification verified WHERE verified.method_version_id=policy.qa_method_version_id
           AND lab_qa_method_valid(NEW.organization_id,policy.qa_method_version_id,verified.id,'independent_qa',NEW.created_at))
         OR EXISTS(SELECT 1 FROM lab_recountattempt WHERE request_id=request.id AND role=NEW.role)
         THEN RAISE EXCEPTION 'Independent self claim, current policy or exposure invalid'; END IF;
     ELSIF TG_TABLE_NAME='lab_recountindependenceattestation' THEN
       IF command.action<>'recount_attest' OR NEW.role NOT IN ('second','third') OR NEW.counter_id IN (NEW.created_by_id,request.first_counter_id)
         OR input->>'counter_id' IS DISTINCT FROM NEW.counter_id::text OR input->>'role' IS DISTINCT FROM NEW.role
         OR input->>'external_reference' IS DISTINCT FROM NEW.external_reference::text
         OR input->>'reason' IS DISTINCT FROM NEW.reason OR input->>'reason_code' IS DISTINCT FROM NEW.reason_code
         OR char_length(btrim(NEW.reason))<10 OR char_length(NEW.reason)>1000 OR btrim(NEW.reason_code)=''
         OR NEW.authority_proof->'cause_ids' IS DISTINCT FROM lab_qa_cause_ids(request.id)
         OR NEW.authority_proof->>'declaration_kind' IS DISTINCT FROM 'external_operational_assessment'
         OR NEW.authority_proof->>'request_id' IS DISTINCT FROM request.id::text
         OR NEW.authority_proof->>'first_count_id' IS DISTINCT FROM request.count_id::text
         OR NEW.authority_proof->>'first_result_id' IS DISTINCT FROM NEW.first_result_id::text
         OR NEW.authority_proof->>'counter_id' IS DISTINCT FROM NEW.counter_id::text
         OR NEW.authority_proof->>'attester_id' IS DISTINCT FROM NEW.created_by_id::text
         OR NEW.authority_proof->>'role' IS DISTINCT FROM NEW.role
         OR NEW.authority_proof->'cause_count' IS DISTINCT FROM to_jsonb(jsonb_array_length(lab_qa_cause_ids(request.id)))
         OR NEW.authority_proof->'attester_actions' IS DISTINCT FROM '["recount.adjudicate","egg_count.read"]'::jsonb
         OR NEW.authority_proof->'target_actions' IS DISTINCT FROM (CASE WHEN NEW.role='third' THEN '["recount.create","recount.adjudicate"]'::jsonb ELSE '["recount.create"]'::jsonb END)
         OR (NEW.authority_proof->>'qa_revision')::integer IS DISTINCT FROM (input->>'expected_revision')::integer
         OR (input->>'expected_result_revision')::integer IS DISTINCT FROM (SELECT revision FROM lab_labresultrevision WHERE id=NEW.first_result_id)
         OR NOT EXISTS(SELECT 1 FROM ovitraps_ovitrapreading reading JOIN ovitraps_ovitrap ovitrap ON ovitrap.id=reading.ovitrap_id
           JOIN geography_samplingpoint point ON point.id=ovitrap.sampling_point_id JOIN geography_block block ON block.id=point.block_id
           JOIN geography_quadrant quadrant ON quadrant.id=block.quadrant_id WHERE reading.id=(SELECT reading_id FROM lab_bagreceipt WHERE id=first_count.receipt_id)
             AND NEW.authority_proof->'actual_context' = jsonb_build_object('center_id',quadrant.center_id::text,'quadrant_id',quadrant.id::text))
         OR EXISTS(SELECT 1 FROM lab_labblindobservation WHERE count_id=first_count.id)
         OR EXISTS(SELECT 1 FROM lab_labnumericdisclosure d JOIN lab_eggcountattempt c ON c.id=d.count_id WHERE c.bag_id=first_count.bag_id AND d.created_by_id=NEW.counter_id)
         OR EXISTS(SELECT 1 FROM lab_eggcountattempt c WHERE c.bag_id=first_count.bag_id AND c.created_by_id=NEW.counter_id)
         OR (NEW.role='third' AND EXISTS(SELECT 1 FROM lab_recountattempt WHERE request_id=request.id AND role='second' AND created_by_id=NEW.counter_id))
         OR EXISTS(SELECT 1 FROM lab_recountattempt WHERE request_id=request.id AND role=NEW.role)
         THEN RAISE EXCEPTION 'Legacy independence assessment is not an active undisclosed real frame'; END IF;
     ELSE
       SELECT * INTO second_count FROM lab_recountattempt WHERE id=NEW.second_id;
       SELECT * INTO third_count FROM lab_recountattempt WHERE id=NEW.third_id;
       SELECT * INTO policy FROM lab_labqapolicyversion WHERE id=NEW.policy_id;
       SELECT resolution.id INTO previous_uuid FROM lab_recountresolution resolution JOIN lab_recountrevision revision ON revision.resolution_id=resolution.id
         WHERE resolution.request_id=request.id ORDER BY revision.revision DESC LIMIT 1;
       required_third=abs(first_count.value-second_count.value)*100>greatest(policy.absolute_tolerance*100,policy.relative_per_100*first_count.value);
       IF command.action<>'recount_adjudicate' OR second_count.request_id IS DISTINCT FROM request.id OR second_count.role<>'second'
         OR NEW.previous_id IS DISTINCT FROM previous_uuid
         OR second_count.claim_id IS NULL OR policy.id IS DISTINCT FROM (SELECT policy_id FROM lab_recountclaim WHERE id=second_count.claim_id)
         OR policy.id IS DISTINCT FROM (SELECT id FROM lab_labqapolicyversion WHERE organization_id=NEW.organization_id ORDER BY revision DESC LIMIT 1)
         OR NOT EXISTS(SELECT 1 FROM lab_labmethodverification verified WHERE verified.method_version_id=second_count.method_version_id
           AND lab_qa_method_valid(NEW.organization_id,second_count.method_version_id,verified.id,'independent_qa',NEW.created_at))
         OR NEW.comparison_proof->'cause_ids' IS DISTINCT FROM lab_qa_cause_ids(request.id)
         OR NEW.comparison_proof IS DISTINCT FROM jsonb_build_object('cause_ids',lab_qa_cause_ids(request.id),'cause_count',jsonb_array_length(lab_qa_cause_ids(request.id)),
           'first',first_count.value,'second',second_count.value,'third',third_count.value,'absolute_tolerance',policy.absolute_tolerance,'relative_per_100',policy.relative_per_100)
         OR (input->>'expected_result_revision')::integer IS DISTINCT FROM (SELECT revision FROM lab_labresultrevision WHERE id=NEW.first_result_id)
         OR input->>'reason' IS DISTINCT FROM NEW.reason OR input->>'reason_code' IS DISTINCT FROM NEW.reason_code
         OR char_length(btrim(NEW.reason))<10 OR char_length(NEW.reason)>1000 OR btrim(NEW.reason_code)=''
         OR (required_third AND (third_count.id IS NULL OR third_count.request_id IS DISTINCT FROM request.id
           OR third_count.role<>'third' OR third_count.created_by_id IN (first_count.created_by_id,second_count.created_by_id)
           OR NEW.created_by_id IS DISTINCT FROM third_count.created_by_id))
         OR (NEW.third_id IS NOT NULL AND (third_count.request_id IS DISTINCT FROM request.id OR third_count.role<>'third'
           OR third_count.created_by_id IN (first_count.created_by_id,second_count.created_by_id)
           OR policy.id IS DISTINCT FROM (SELECT policy_id FROM lab_recountclaim WHERE id=third_count.claim_id)))
         OR (NEW.selected_count_id IS NOT NULL AND NEW.selected_count_id IS DISTINCT FROM first_count.id)
         OR (NEW.selected_attempt_id IS NOT NULL AND NEW.selected_attempt_id IS DISTINCT FROM second_count.id AND NEW.selected_attempt_id IS DISTINCT FROM third_count.id)
         OR input->>'final_attempt_id' IS DISTINCT FROM COALESCE(NEW.selected_count_id,NEW.selected_attempt_id)::text
         THEN RAISE EXCEPTION 'Adjudication needs its genuine distinct observations and exact typed choice'; END IF;
     END IF;
   END IF;
 ELSIF TG_TABLE_NAME='lab_recountrevision' THEN
   SELECT id,revision INTO previous_uuid,previous_revision FROM lab_recountrevision WHERE request_id=NEW.request_id ORDER BY revision DESC LIMIT 1;
   SELECT * INTO command FROM lab_labcommand WHERE id=NEW.command_id;
   IF NEW.previous_id IS DISTINCT FROM previous_uuid OR NEW.revision<>COALESCE(previous_revision,0)+1
     OR (command.canonical_input->>'expected_revision')::integer IS DISTINCT FROM NEW.revision-1
     OR NOT EXISTS(SELECT 1 FROM (
       SELECT id,request_id,command_id,created_by_id FROM lab_recountclaim WHERE id=NEW.claim_id UNION ALL
       SELECT id,request_id,command_id,created_by_id FROM lab_recountattempt WHERE id=NEW.attempt_id UNION ALL
       SELECT id,request_id,command_id,created_by_id FROM lab_recountresolution WHERE id=NEW.resolution_id UNION ALL
       SELECT id,request_id,command_id,created_by_id FROM lab_recountindependenceattestation WHERE id=NEW.attestation_id
     ) cause WHERE cause.request_id=NEW.request_id AND cause.command_id=NEW.command_id AND cause.created_by_id=NEW.created_by_id)
     THEN RAISE EXCEPTION 'QA revision requires exact append-only CAS and authored cause'; END IF;
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
"""

PHYSICAL = r"""
CREATE FUNCTION lab_paddle_fact_guard() RETURNS trigger AS $$
DECLARE registered lab_eggpaddle; binding lab_paddlebagbinding; prior lab_paddlebagbinding;
        command lab_labcommand; source inventory_stockmovement; policy lab_labqapolicyversion;
        bag ovitraps_bag; expected_cycle integer;
BEGIN
 SELECT * INTO command FROM lab_labcommand WHERE id=NEW.command_id;
 IF command.created_by_id IS DISTINCT FROM NEW.created_by_id OR command.organization_id IS DISTINCT FROM NEW.organization_id
   OR command.canonical_input->'evidence_ids' IS DISTINCT FROM NEW.evidence_ids
   OR jsonb_typeof(NEW.evidence_ids) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.evidence_ids)=0
   THEN RAISE EXCEPTION 'Paddle operation requires its exact genuine authored declaration'; END IF;
 IF TG_TABLE_NAME='lab_eggpaddle' THEN
   SELECT * INTO source FROM inventory_stockmovement WHERE id=NEW.source_movement_id;
   IF command.action<>'paddle_register' OR command.source_id IS NOT NULL OR command.target_id IS DISTINCT FROM NEW.piece_id
     OR command.canonical_input->>'piece_id' IS DISTINCT FROM NEW.piece_id::text
     OR command.canonical_input->>'code' IS DISTINCT FROM NEW.code
     OR command.canonical_input->>'source_movement_id' IS DISTINCT FROM NEW.source_movement_id::text
     OR command.canonical_input->>'location_id' IS DISTINCT FROM NEW.location_id::text
     OR source.piece_id IS DISTINCT FROM NEW.piece_id OR source.location_id IS DISTINCT FROM NEW.location_id OR source.quantity<>1
     OR NEW.source_proof IS DISTINCT FROM jsonb_build_object('piece_id',NEW.piece_id::text,'source_movement_id',source.id::text,'location_id',NEW.location_id::text,'observation','forward_physical_identity')
     OR NOT EXISTS(SELECT 1 FROM inventory_piece piece JOIN inventory_supplytypeversion unit ON unit.id=source.unit_version_id
       WHERE piece.id=NEW.piece_id AND piece.lot_id=source.lot_id AND unit.identity_kind='piece' AND unit.supply_type_id=(SELECT supply_id FROM inventory_lot WHERE id=piece.lot_id))
     OR (SELECT COALESCE(SUM(quantity),0) FROM inventory_stockmovement WHERE organization_id=NEW.organization_id
       AND piece_id=NEW.piece_id AND location_id=NEW.location_id AND unit_version_id=source.unit_version_id)<>1
     THEN RAISE EXCEPTION 'Paddle identity requires its actual positive Piece/custody, never code adoption'; END IF;
 ELSIF TG_TABLE_NAME='lab_paddlebagbinding' THEN
   SELECT * INTO registered FROM lab_eggpaddle WHERE id=NEW.paddle_id;
   SELECT * INTO source FROM inventory_stockmovement WHERE id=NEW.issue_movement_id;
   SELECT * INTO bag FROM ovitraps_bag WHERE id=NEW.bag_id;
   SELECT * INTO prior FROM lab_paddlebagbinding WHERE paddle_id=registered.id ORDER BY cycle DESC LIMIT 1;
   expected_cycle=COALESCE(prior.cycle,0)+1;
   IF command.action<>'paddle_bind' OR command.source_id IS DISTINCT FROM bag.event_id OR command.target_id IS DISTINCT FROM registered.id
     OR command.canonical_input->>'bag_id' IS DISTINCT FROM NEW.bag_id::text
     OR command.canonical_input->>'issue_movement_id' IS DISTINCT FROM NEW.issue_movement_id::text
     OR (command.canonical_input->>'expected_revision')::integer IS DISTINCT FROM expected_cycle-1
     OR NEW.previous_id IS DISTINCT FROM prior.id OR NEW.cycle<>expected_cycle OR NEW.source_id IS DISTINCT FROM bag.event_id
     OR source.piece_id IS DISTINCT FROM registered.piece_id OR registered.created_at>=source.created_at
     OR registered.created_at>=(SELECT server_received_at FROM field_sync_fieldevent WHERE id=bag.event_id)
     OR NOT COALESCE(lab_paddle_issue_valid(source.id,bag.id),false)
     OR NOT EXISTS(SELECT 1 FROM inventory_supplystockeffect effect JOIN field_sync_fieldevent event ON event.id=bag.event_id
       WHERE effect.movement_id=source.id AND NEW.source_proof=jsonb_build_object('reading_id',bag.reading_id::text,'source_id',bag.event_id::text,
         'source_hash',event.payload_sha256,'issue_effect_id',effect.id::text,'receipt_line_id',effect.receipt_line_id::text))
     OR EXISTS(SELECT 1 FROM inventory_bagdisposition WHERE bag_id=bag.id)
     OR (prior.id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM lab_paddlereuse reused
       JOIN field_sync_fieldevent collected ON collected.id=bag.event_id
       WHERE reused.binding_id=prior.id AND reused.dried_at<=source.created_at
       AND collected.device_time>reused.dried_at AND collected.server_received_at>reused.dried_at
       AND reused.first_result_id=(SELECT id FROM lab_labresultrevision WHERE bag_id=prior.bag_id ORDER BY revision DESC LIMIT 1)
       AND lab_paddle_draw_current(reused.sample_member_id,NEW.created_at)
       AND reused.qa_revision_id IS NOT DISTINCT FROM (SELECT revision.id FROM lab_recountrevision revision
         JOIN lab_recountresolution resolution ON resolution.id=revision.resolution_id JOIN lab_recountrequest request ON request.id=resolution.request_id
         WHERE request.count_id=(SELECT count_id FROM lab_labresultrevision WHERE id=reused.first_result_id)
         AND lab_qa_resolution_current(request.id,reused.first_result_id) ORDER BY revision.revision DESC LIMIT 1)
       AND NOT EXISTS(SELECT 1 FROM lab_recountrequest q JOIN lab_eggcountattempt c ON c.id=q.count_id
         WHERE c.bag_id=prior.bag_id AND NOT EXISTS(SELECT 1 FROM lab_recountrequestsupersession WHERE request_id=q.id)
         AND NOT lab_qa_resolution_current(q.id,reused.first_result_id))))
     THEN RAISE EXCEPTION 'Paddle binding requires forward real issue, nonoverlapping cycle and retained QA'; END IF;
 ELSIF TG_TABLE_NAME='lab_paddlereuse' THEN
   SELECT * INTO binding FROM lab_paddlebagbinding WHERE id=NEW.binding_id;
   SELECT * INTO registered FROM lab_eggpaddle WHERE id=binding.paddle_id;
   SELECT * INTO policy FROM lab_labqapolicyversion WHERE id=(NEW.frame_proof->>'qa_policy_id')::uuid;
   IF command.action<>'paddle_reuse' OR command.source_id IS DISTINCT FROM binding.source_id OR command.target_id IS DISTINCT FROM registered.id
     OR command.canonical_input->>'binding_id' IS DISTINCT FROM binding.id::text
     OR command.canonical_input->>'source_movement_id' IS DISTINCT FROM NEW.source_movement_id::text
     OR command.canonical_input->>'destination_location_id' IS DISTINCT FROM NEW.destination_id::text
     OR command.canonical_input->>'method_version' IS DISTINCT FROM NEW.method_version_id::text
     OR (command.canonical_input->>'washed_at')::timestamptz IS DISTINCT FROM NEW.washed_at
     OR (command.canonical_input->>'dried_at')::timestamptz IS DISTINCT FROM NEW.dried_at
     OR NEW.washed_at>NEW.dried_at OR NEW.dried_at>NEW.created_at
     OR (command.canonical_input->>'expected_revision')::integer IS DISTINCT FROM binding.cycle
     OR binding.cycle<>(SELECT MAX(cycle) FROM lab_paddlebagbinding WHERE paddle_id=registered.id)
     OR policy.id IS DISTINCT FROM (SELECT id FROM lab_labqapolicyversion WHERE organization_id=NEW.organization_id ORDER BY revision DESC LIMIT 1)
     OR policy.reuse_method_version_id IS DISTINCT FROM NEW.method_version_id
     OR NOT COALESCE(lab_qa_method_valid(NEW.organization_id,NEW.method_version_id,NEW.verification_id,'paddle_reuse',NEW.created_at),false)
     OR NOT EXISTS(SELECT 1 FROM lab_labmethodverification verified WHERE verified.method_version_id=policy.qa_method_version_id
       AND lab_qa_method_valid(NEW.organization_id,policy.qa_method_version_id,verified.id,'independent_qa',NEW.created_at))
     OR NEW.reuse_number<>1+(SELECT count(*) FROM lab_paddlereuse reused JOIN lab_paddlebagbinding prior_binding ON prior_binding.id=reused.binding_id WHERE prior_binding.paddle_id=registered.id)
     OR NOT EXISTS(SELECT 1 FROM rules_ruleparameterversion version JOIN rules_ruleparameter parameter ON parameter.id=version.parameter_id
       WHERE version.id=(NEW.frame_proof->'reuse_rule'->>'version_id')::uuid AND parameter.organization_id=NEW.organization_id
       AND parameter.key='max_paddle_reuses' AND parameter.value_type='integer' AND parameter.unit='count'
       AND version.value BETWEEN 0 AND 2 AND version.value=trunc(version.value) AND version.voided_at IS NULL
       AND version.value=(NEW.frame_proof->'reuse_rule'->>'value')::numeric AND NEW.reuse_number<=version.value
       AND version.id=(SELECT current_version.id FROM rules_ruleparameterversion current_version WHERE current_version.parameter_id=parameter.id
         AND current_version.voided_at IS NULL AND current_version.effective_from<=NEW.created_at ORDER BY current_version.effective_from DESC,current_version.created_at DESC LIMIT 1))
     OR EXISTS(SELECT 1 FROM inventory_bagdisposition WHERE bag_id=binding.bag_id)
     THEN RAISE EXCEPTION 'Reuse requires current real cycle, clocks, named methods and bounded rule'; END IF;
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION lab_paddle_frame_complete() RETURNS trigger AS $$
DECLARE entry record; final_value bigint; current_result lab_labresultrevision;
        resolution lab_recountresolution; qa_revision lab_recountrevision; selected_uuid uuid;
BEGIN
 IF TG_TABLE_NAME IN ('lab_eggpaddle','lab_paddlebagbinding','lab_paddlereuse') THEN
   IF NOT EXISTS(SELECT 1 FROM lab_labcommandresult WHERE command_id=NEW.command_id AND status=201)
     THEN RAISE EXCEPTION 'Physical operation requires completed actual command'; END IF;
   FOR entry IN SELECT value #>> '{}' AS identifier FROM jsonb_array_elements(NEW.evidence_ids) LOOP
     IF NOT EXISTS(SELECT 1 FROM uploads_upload upload JOIN uploads_uploadverification verified ON verified.upload_id=upload.id
       JOIN uploads_attachmentlink link ON link.upload_id=upload.id WHERE upload.public_id=entry.identifier::uuid
       AND upload.organization_id=NEW.organization_id AND upload.uploader_id=NEW.created_by_id
       AND link.lab_paddle_command_id=NEW.command_id AND link.created_by_id=NEW.created_by_id)
       THEN RAISE EXCEPTION 'Physical operation requires its actual verified owned primary evidence'; END IF;
   END LOOP;
 END IF;
 IF TG_TABLE_NAME='lab_paddlereuse' THEN
   SELECT r.* INTO current_result FROM lab_labresultrevision r JOIN lab_paddlebagbinding binding ON binding.bag_id=r.bag_id
     WHERE binding.id=NEW.binding_id ORDER BY r.revision DESC LIMIT 1;
   SELECT resolved.* INTO resolution FROM lab_recountresolution resolved JOIN lab_recountrevision revision ON revision.resolution_id=resolved.id
     JOIN lab_recountrequest request ON request.id=resolved.request_id WHERE request.count_id=current_result.count_id
     AND lab_qa_resolution_current(request.id,current_result.id) ORDER BY revision.revision DESC LIMIT 1;
   SELECT * INTO qa_revision FROM lab_recountrevision WHERE resolution_id=resolution.id;
   selected_uuid=COALESCE(resolution.selected_count_id,resolution.selected_attempt_id,current_result.count_id);
   SELECT COALESCE(selected_first.value,selected_independent.value,first_count.value) INTO final_value
     FROM lab_eggcountattempt first_count LEFT JOIN lab_recountrequest request ON request.count_id=first_count.id
     LEFT JOIN LATERAL(SELECT candidate_resolution.* FROM lab_recountresolution candidate_resolution JOIN lab_recountrevision revision ON revision.resolution_id=candidate_resolution.id
       WHERE candidate_resolution.request_id=request.id ORDER BY revision.revision DESC LIMIT 1) latest_resolution ON true
     LEFT JOIN lab_eggcountattempt selected_first ON selected_first.id=latest_resolution.selected_count_id
     LEFT JOIN lab_recountattempt selected_independent ON selected_independent.id=latest_resolution.selected_attempt_id
     WHERE first_count.id=current_result.count_id;
   IF current_result.count_id IS NULL OR current_result.id IS DISTINCT FROM NEW.first_result_id OR final_value IS DISTINCT FROM 0
     OR NOT COALESCE(lab_paddle_draw_current(NEW.sample_member_id,NEW.created_at),false)
     OR NEW.qa_revision_id IS DISTINCT FROM qa_revision.id
     OR (SELECT (canonical_input->>'expected_qa_revision')::integer FROM lab_labcommand WHERE id=NEW.command_id) IS DISTINCT FROM COALESCE(qa_revision.revision,0)
     OR NEW.frame_proof->'qa' IS DISTINCT FROM jsonb_build_object('result_revision_id',current_result.id::text,'result_revision',current_result.revision,
       'count_id',current_result.count_id::text,'resolution_id',resolution.id::text,'qa_revision_id',qa_revision.id::text,'qa_revision',COALESCE(qa_revision.revision,0),
       'sample_member_id',NEW.sample_member_id::text,'sample_frame_hash',NEW.frame_proof->'qa'->>'sample_frame_hash','selected_attempt_id',selected_uuid::text,'final_value',0)
     OR (SELECT (canonical_input->>'expected_result_revision')::integer FROM lab_labcommand WHERE id=NEW.command_id) IS DISTINCT FROM current_result.revision
     OR NOT EXISTS(SELECT 1 FROM lab_dailyrecountsamplemember member JOIN lab_dailyrecountsample sample ON sample.id=member.sample_id
       JOIN organizations_organization organization ON organization.id=NEW.organization_id
       WHERE member.id=NEW.sample_member_id AND member.count_id=current_result.count_id
       AND sample.organization_id=NEW.organization_id AND sample.timezone=organization.timezone
       AND sample.rules->'organization_revision'=to_jsonb(organization.revision)
       AND sample.frame_hash=NEW.frame_proof->'qa'->>'sample_frame_hash'
       AND sample.revision=(SELECT MAX(revision) FROM lab_dailyrecountsample WHERE organization_id=sample.organization_id AND local_day=sample.local_day)
       AND (NOT member.selected OR EXISTS(SELECT 1 FROM lab_recountrequest request WHERE request.count_id=member.count_id AND lab_qa_resolution_current(request.id,current_result.id))))
     OR EXISTS(SELECT 1 FROM lab_recountrequest request JOIN lab_eggcountattempt first_count ON first_count.id=request.count_id
       WHERE first_count.bag_id=current_result.bag_id AND NOT EXISTS(SELECT 1 FROM lab_recountrequestsupersession WHERE request_id=request.id)
       AND NOT lab_qa_resolution_current(request.id,current_result.id))
     OR NOT EXISTS(SELECT 1 FROM inventory_paddlestockreturn WHERE reuse_id=NEW.id)
     THEN RAISE EXCEPTION 'Reuse requires its genuine negative current draw/QA and completed stock receipt'; END IF;
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION lab_reused_material_guard() RETURNS trigger AS $$
BEGIN
 IF TG_TABLE_NAME IN ('lab_eggcountattempt','lab_labrejection') THEN
   IF EXISTS(SELECT 1 FROM lab_paddlereuse reused JOIN lab_paddlebagbinding binding ON binding.id=reused.binding_id WHERE binding.bag_id=NEW.bag_id)
     THEN RAISE EXCEPTION 'Treated Bag material is unavailable for a new measurement'; END IF;
 ELSIF TG_TABLE_NAME='lab_labresultvoid' THEN
   IF EXISTS(SELECT 1 FROM lab_paddlereuse reused JOIN lab_paddlebagbinding binding ON binding.id=reused.binding_id
     JOIN lab_labresultrevision result ON result.id=reused.first_result_id WHERE NEW.count_id=result.count_id OR NEW.rejection_id=result.rejection_id)
     THEN RAISE EXCEPTION 'Result correction must preserve its actual physical reuse dependent'; END IF;
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
"""

COMPLETE = r"""
CREATE FUNCTION lab_qa_complete_guard() RETURNS trigger AS $$
DECLARE command lab_labcommand; expected_action text; actual_count integer;
BEGIN
 IF TG_TABLE_NAME='lab_labcommandresult' THEN
   SELECT * INTO command FROM lab_labcommand WHERE id=NEW.command_id;
   IF command.action IN ('recount_claim','recount','recount_adjudicate','recount_attest','paddle_register','paddle_bind','paddle_reuse') THEN
     SELECT count(*) INTO actual_count FROM (
       SELECT 'recount_claim' action,command_id FROM lab_recountclaim UNION ALL SELECT 'recount',command_id FROM lab_recountattempt
       UNION ALL SELECT 'recount_adjudicate',command_id FROM lab_recountresolution UNION ALL SELECT 'recount_attest',command_id FROM lab_recountindependenceattestation
       UNION ALL SELECT 'paddle_register',command_id FROM lab_eggpaddle UNION ALL SELECT 'paddle_bind',command_id FROM lab_paddlebagbinding UNION ALL SELECT 'paddle_reuse',command_id FROM lab_paddlereuse
     ) facts WHERE facts.command_id=command.id AND facts.action=command.action;
     IF (NEW.status=201 AND actual_count<>1) OR (NEW.status<>201 AND actual_count<>0)
       THEN RAISE EXCEPTION 'Independent command must commit exactly its real typed effect or no effect'; END IF;
   END IF;
 ELSIF TG_TABLE_NAME IN ('lab_recountclaim','lab_recountattempt','lab_recountresolution','lab_recountindependenceattestation') THEN
   IF NOT EXISTS(SELECT 1 FROM lab_recountrevision WHERE command_id=NEW.command_id AND request_id=NEW.request_id)
     OR NOT EXISTS(SELECT 1 FROM lab_labcommandresult WHERE command_id=NEW.command_id AND status=201)
     THEN RAISE EXCEPTION 'Independent fact requires completed command/revision'; END IF;
 ELSIF TG_TABLE_NAME='lab_eggcountattempt' THEN
   IF NEW.ordinal=1 AND NEW.replacement_of_id IS NULL
      AND EXISTS(SELECT 1 FROM lab_labcommand WHERE id=NEW.command_id AND action='count')
      AND NOT EXISTS(SELECT 1 FROM lab_labblindobservation WHERE count_id=NEW.id)
     THEN RAISE EXCEPTION 'New first observation requires its forward policy boundary'; END IF;
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
"""

FORWARD = (
    HELPERS
    + NEW_INSERT
    + NEW_COMPLETE
    + NEW_SOURCE
    + INSERT_GUARD
    + COMPLETE
    + PHYSICAL
    + "\n".join(
        f"CREATE TRIGGER lab_{name}_guard BEFORE UPDATE OR DELETE ON lab_{name} FOR EACH ROW EXECUTE FUNCTION lab_insert_only_guard();\n"
        f"CREATE TRIGGER lab_{name}_insert_guard BEFORE INSERT ON lab_{name} FOR EACH ROW EXECUTE FUNCTION lab_insert_guard();\n"
        f"CREATE TRIGGER lab_{name}_qa_guard BEFORE INSERT ON lab_{name} FOR EACH ROW EXECUTE FUNCTION lab_qa_insert_guard();\n"
        f"CREATE CONSTRAINT TRIGGER lab_{name}_qa_complete AFTER INSERT ON lab_{name} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lab_qa_complete_guard();"
        for name in TABLES
    )
    + "\n".join(
        f"CREATE CONSTRAINT TRIGGER lab_{name}_qa_complete AFTER INSERT ON lab_{name} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lab_qa_complete_guard();"
        for name in ("eggcountattempt", "labcommandresult")
    )
    + "\n".join(
        f"CREATE TRIGGER lab_{name}_physical_guard BEFORE INSERT ON lab_{name} FOR EACH ROW EXECUTE FUNCTION lab_paddle_fact_guard();\n"
        f"CREATE CONSTRAINT TRIGGER lab_{name}_physical_complete AFTER INSERT ON lab_{name} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION lab_paddle_frame_complete();"
        for name in ("eggpaddle", "paddlebagbinding", "paddlereuse")
    )
    + "\n".join(
        f"CREATE TRIGGER lab_{name}_reused_material_guard BEFORE INSERT ON lab_{name} FOR EACH ROW EXECUTE FUNCTION lab_reused_material_guard();"
        for name in ("eggcountattempt", "labrejection", "labresultvoid")
    )
)

REVERSE = (
    "\n".join(
        f"DROP TRIGGER lab_{name}_physical_guard ON lab_{name}; DROP TRIGGER lab_{name}_physical_complete ON lab_{name};"
        for name in ("eggpaddle", "paddlebagbinding", "paddlereuse")
    )
    + "\n".join(
        f"DROP TRIGGER lab_{name}_reused_material_guard ON lab_{name};"
        for name in ("eggcountattempt", "labrejection", "labresultvoid")
    )
    + "DROP FUNCTION lab_reused_material_guard(); DROP FUNCTION lab_paddle_frame_complete(); DROP FUNCTION lab_paddle_fact_guard();"
    + "\n".join(
        f"DROP TRIGGER lab_{name}_qa_complete ON lab_{name};"
        for name in (*TABLES, "eggcountattempt", "labcommandresult")
    )
    + "\n".join(
        f"DROP TRIGGER lab_{name}_qa_guard ON lab_{name}; DROP TRIGGER lab_{name}_insert_guard ON lab_{name}; DROP TRIGGER lab_{name}_guard ON lab_{name};"
        for name in TABLES
    )
    + """
DROP FUNCTION lab_qa_complete_guard(); DROP FUNCTION lab_qa_insert_guard();
DROP FUNCTION lab_paddle_draw_current(uuid,timestamptz);
DROP FUNCTION lab_paddle_issue_valid(uuid,uuid); DROP FUNCTION lab_qa_resolution_current(uuid,uuid);
DROP FUNCTION lab_qa_independent(uuid,uuid,text,uuid); DROP FUNCTION lab_qa_request_frame(uuid,uuid);
DROP FUNCTION lab_qa_method_valid(uuid,uuid,uuid,text,timestamptz); DROP FUNCTION lab_qa_cause_ids(uuid);
"""
    + OLD_INSERT
    + OLD_COMPLETE
    + OLD_SOURCE
)


def protect_reverse(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    models = (
        "LabQAPolicyVersion",
        "LabBlindObservation",
        "LabNumericDisclosure",
        "RecountIndependenceAttestation",
        "RecountClaim",
        "RecountAttempt",
        "RecountResolution",
        "RecountRevision",
        "EggPaddle",
        "PaddleBagBinding",
        "PaddleReuse",
    )
    if (
        any(apps.get_model("lab", name).objects.exists() for name in models)
        or apps.get_model("lab", "LabMethodVersion")
        .objects.filter(supports_independent_qa=True)
        .exists()
        or apps.get_model("lab", "LabMethodVersion")
        .objects.filter(supports_paddle_reuse=True)
        .exists()
    ):
        raise IrreversibleError(
            "Retain independent observations, exposure, methods and physical audit."
        )


class Migration(migrations.Migration):
    dependencies = [
        ("lab", "0004_independent_qa_and_paddles"),
        ("inventory", "0008_independent_qa_and_paddles"),
        ("uploads", "0007_independent_qa_and_paddles"),
    ]
    operations = [
        migrations.RunSQL(FORWARD, REVERSE),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
