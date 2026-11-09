"""Append-only people facts, coherent private evidence and genuine publication proofs."""

from django.apps.registry import Apps
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.exceptions import IrreversibleError

TABLES = (
    "people_training",
    "people_trainingversion",
    "people_actiontrainingrequirementversion",
    "people_certification",
    "people_certificationrevocation",
    "people_evaluationrubric",
    "people_evaluationrubricversion",
    "people_evaluation",
    "people_evaluationattempt",
    "people_evaluationvoid",
    "people_evaluationcompletion",
    "people_evaluationnoticepolicyversion",
    "people_trainingnoticecause",
    "people_trainingnoticeintent",
    "people_trainingnoticepublication",
    "people_trainingnoticeroute",
    "people_eligibilityassessmentreceipt",
    "people_peoplecommand",
)

GUARDS = r"""
CREATE FUNCTION people_notice_contexts(cause_identifier uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH cause AS (SELECT * FROM people_trainingnoticecause WHERE id=cause_identifier),
  active AS (
    SELECT completion.sequence,attempt.outcome,evaluation.center_id,evaluation.quadrant_id
    FROM cause JOIN people_evaluationcompletion completion
      ON completion.organization_id=cause.organization_id AND completion.subject_id=cause.subject_id
    JOIN people_evaluationattempt attempt ON attempt.id=completion.attempt_id
    JOIN people_evaluation evaluation ON evaluation.id=attempt.evaluation_id
    WHERE cause.kind='third_adverse'
      AND NOT EXISTS(SELECT 1 FROM people_evaluationattempt successor WHERE successor.predecessor_id=attempt.id)
      AND NOT EXISTS(SELECT 1 FROM people_evaluationvoid WHERE evaluation_id=evaluation.id)
  ), bounds AS (
    SELECT entry->>'center_id' AS center_id,entry->>'quadrant_id' AS quadrant_id
      FROM cause CROSS JOIN LATERAL jsonb_array_elements(cause.contexts) entry
    UNION
    SELECT center_id::text,quadrant_id::text FROM active
      WHERE sequence>COALESCE((SELECT max(sequence) FROM active WHERE outcome='pass'),0)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('center_id',center_id,'quadrant_id',quadrant_id)
    ORDER BY center_id,quadrant_id),'[]'::jsonb) FROM bounds;
$$;

CREATE FUNCTION people_fact_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  facts jsonb := to_jsonb(NEW);
  relation record;
  reference uuid;
  matched boolean;
  expected_revision bigint;
  parent record;
  context jsonb;
  pinned jsonb;
  named record;
  item jsonb;
  rubric people_evaluationrubricversion;
  observation people_evaluationattempt;
  evaluation people_evaluation;
  certificate people_certification;
  cause people_trainingnoticecause;
  weighted numeric := 0;
  missing boolean := false;
  failed boolean := false;
  section text;
  expected_outcome text;
  previous_pass bigint;
  episode uuid[];
  required_contexts jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'People facts are insert only' USING ERRCODE='23514';
  END IF;
  IF NEW.created_by_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM organizations_membership
    WHERE organization_id=NEW.organization_id AND user_id=NEW.created_by_id
  ) THEN RAISE EXCEPTION 'People author tenant mismatch' USING ERRCODE='23514'; END IF;
  IF facts ? 'subject_id' AND NOT EXISTS(
    SELECT 1 FROM organizations_membership
    WHERE organization_id=NEW.organization_id AND user_id=(facts->>'subject_id')::uuid
  ) THEN RAISE EXCEPTION 'People subject tenant mismatch' USING ERRCODE='23514'; END IF;
  IF facts ? 'center_id' AND NOT EXISTS(
    SELECT 1 FROM organizations_center WHERE id=(facts->>'center_id')::uuid
      AND organization_id=NEW.organization_id
  ) THEN RAISE EXCEPTION 'People center tenant mismatch' USING ERRCODE='23514'; END IF;
  IF facts->>'quadrant_id' IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM geography_quadrant WHERE id=(facts->>'quadrant_id')::uuid
      AND organization_id=NEW.organization_id AND center_id=(facts->>'center_id')::uuid
  ) THEN RAISE EXCEPTION 'People quadrant context mismatch' USING ERRCODE='23514'; END IF;
  -- Static relation registry; only values are supplied by the inserted fact.
  FOR relation IN SELECT * FROM jsonb_each_text('{
    "training_id":"people_training","training_version_id":"people_trainingversion",
    "certification_id":"people_certification","rubric_id":"people_evaluationrubric",
    "rubric_version_id":"people_evaluationrubricversion","evaluation_id":"people_evaluation",
    "attempt_id":"people_evaluationattempt","episode_start_id":"people_evaluationcompletion",
    "completion_id":"people_evaluationcompletion","cause_id":"people_trainingnoticecause",
    "intent_id":"people_trainingnoticeintent","policy_id":"people_evaluationnoticepolicyversion",
    "recipient_membership_id":"organizations_membership","session_id":"accounts_devicesession"
  }'::jsonb) LOOP
    reference := (facts->>relation.key)::uuid;
    IF reference IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I WHERE id=$1 AND organization_id=$2)',relation.value)
        INTO matched USING reference, NEW.organization_id;
      IF NOT matched THEN
        RAISE EXCEPTION 'People related tenant mismatch' USING ERRCODE='23514';
      END IF;
    END IF;
  END LOOP;
  IF facts ? 'reason' AND (TG_TABLE_NAME <> 'people_evaluationattempt' OR (facts->>'revision')::bigint > 1)
    AND (char_length(facts->>'reason')>1000
      OR char_length(regexp_replace(facts->>'reason','[[:space:][:cntrl:]]','','g'))<10
      OR btrim(facts->>'reason_code')='')
  THEN RAISE EXCEPTION 'People correction needs retained reason' USING ERRCODE='23514'; END IF;

  CASE TG_TABLE_NAME
  WHEN 'people_trainingversion' THEN
    SELECT COALESCE(max(version),0)+1 INTO expected_revision FROM people_trainingversion
      WHERE training_id=NEW.training_id;
    IF NEW.version<>expected_revision OR jsonb_typeof(NEW.enabled_actions) IS DISTINCT FROM 'array'
      OR jsonb_array_length(NEW.enabled_actions)=0
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.enabled_actions) entry
        WHERE jsonb_typeof(entry)<>'string' OR btrim(entry#>>'{}')='')
    THEN RAISE EXCEPTION 'People training version mismatch' USING ERRCODE='23514'; END IF;
  WHEN 'people_actiontrainingrequirementversion' THEN
    SELECT COALESCE(max(revision),0)+1 INTO expected_revision
      FROM people_actiontrainingrequirementversion WHERE organization_id=NEW.organization_id
        AND action=NEW.action AND center_id=NEW.center_id
        AND quadrant_id IS NOT DISTINCT FROM NEW.quadrant_id;
    IF NEW.revision<>expected_revision OR btrim(NEW.action)=''
      OR jsonb_typeof(NEW.acceptable_versions) IS DISTINCT FROM 'object'
      OR NEW.acceptable_versions='{}'::jsonb
    THEN RAISE EXCEPTION 'People requirement version mismatch' USING ERRCODE='23514'; END IF;
    FOR named IN SELECT * FROM jsonb_each(NEW.acceptable_versions) LOOP
      IF jsonb_typeof(named.value) IS DISTINCT FROM 'array' OR jsonb_array_length(named.value)=0 THEN
        RAISE EXCEPTION 'People requirement pins missing' USING ERRCODE='23514';
      END IF;
      FOR pinned IN SELECT * FROM jsonb_array_elements(named.value) LOOP
        IF NOT EXISTS(SELECT 1 FROM people_trainingversion version
          WHERE version.id=(pinned#>>'{}')::uuid AND version.training_id=named.key::uuid
            AND version.organization_id=NEW.organization_id AND version.is_active
            AND version.enabled_actions ? NEW.action) THEN
          RAISE EXCEPTION 'People requirement pin mismatch' USING ERRCODE='23514';
        END IF;
      END LOOP;
    END LOOP;
  WHEN 'people_certification' THEN
    SELECT * INTO parent FROM people_trainingversion WHERE id=NEW.training_version_id;
    IF NOT parent.is_active OR NEW.revision<>1 OR NEW.valid_to<=NEW.valid_from
      OR extract(epoch FROM NEW.valid_to-NEW.valid_from)>parent.validity_seconds
      OR btrim(NEW.issuer_reference)='' OR btrim(NEW.attestation)=''
      OR jsonb_typeof(NEW.evidence_ids) IS DISTINCT FROM 'array'
      OR jsonb_array_length(NEW.evidence_ids)=0
      OR jsonb_array_length(NEW.evidence_ids)<>(SELECT count(DISTINCT value) FROM jsonb_array_elements(NEW.evidence_ids))
    THEN RAISE EXCEPTION 'People certification proof mismatch' USING ERRCODE='23514'; END IF;
  WHEN 'people_certificationrevocation' THEN
    SELECT COALESCE(max(revision),1)+1 INTO expected_revision FROM people_certificationrevocation
      WHERE certification_id=NEW.certification_id;
    IF NEW.revision<>expected_revision THEN
      RAISE EXCEPTION 'People certification revision mismatch' USING ERRCODE='23514';
    END IF;
  WHEN 'people_evaluationrubricversion' THEN
    SELECT COALESCE(max(version),0)+1 INTO expected_revision FROM people_evaluationrubricversion
      WHERE rubric_id=NEW.rubric_id;
    IF NEW.version<>expected_revision OR jsonb_typeof(NEW.weights) IS DISTINCT FROM 'object'
      OR NOT NEW.weights ?& ARRAY['presentation','execution','coverage']
      OR NEW.weights-ARRAY['presentation','execution','coverage']<>'{}'::jsonb
      OR EXISTS(SELECT 1 FROM jsonb_each(NEW.weights)
        WHERE jsonb_typeof(value)<>'number' OR (value#>>'{}')!~'^[0-9]+$'
          OR (value#>>'{}')::numeric NOT BETWEEN 0 AND 100)
      OR (SELECT sum(value::numeric) FROM jsonb_each_text(NEW.weights))<>100
      OR jsonb_typeof(NEW.critical_checks) IS DISTINCT FROM 'array'
      OR jsonb_array_length(NEW.critical_checks)=0
      OR jsonb_array_length(NEW.critical_checks)<>(SELECT count(DISTINCT value) FROM jsonb_array_elements(NEW.critical_checks))
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.critical_checks)
        WHERE jsonb_typeof(value)<>'string' OR btrim(value#>>'{}')='')
    THEN RAISE EXCEPTION 'People rubric version mismatch' USING ERRCODE='23514'; END IF;
  WHEN 'people_evaluation' THEN
    IF NOT EXISTS(SELECT 1 FROM people_evaluationrubricversion version
      WHERE version.id=NEW.rubric_version_id AND version.effective_from<=NEW.created_at) THEN
      RAISE EXCEPTION 'People rubric not effective' USING ERRCODE='23514';
    END IF;
  WHEN 'people_evaluationattempt' THEN
    SELECT * INTO evaluation FROM people_evaluation WHERE id=NEW.evaluation_id;
    SELECT * INTO rubric FROM people_evaluationrubricversion WHERE id=evaluation.rubric_version_id;
    SELECT COALESCE(max(revision),0)+1 INTO expected_revision FROM people_evaluationattempt
      WHERE evaluation_id=NEW.evaluation_id;
    IF NEW.revision<>expected_revision
      OR (NEW.predecessor_id IS NULL) IS DISTINCT FROM (NEW.revision=1)
      OR (NEW.predecessor_id IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM people_evaluationattempt previous WHERE previous.id=NEW.predecessor_id
          AND previous.evaluation_id=NEW.evaluation_id AND previous.revision=NEW.revision-1
          AND previous.organization_id=NEW.organization_id))
      OR EXISTS(SELECT 1 FROM people_evaluationvoid WHERE evaluation_id=NEW.evaluation_id)
      OR jsonb_typeof(NEW.section_scores) IS DISTINCT FROM 'object'
      OR NEW.section_scores-ARRAY['presentation','execution','coverage']<>'{}'::jsonb
      OR jsonb_typeof(NEW.critical_responses) IS DISTINCT FROM 'object'
      OR EXISTS(SELECT 1 FROM jsonb_object_keys(NEW.critical_responses) key
        WHERE NOT rubric.critical_checks ? key)
    THEN RAISE EXCEPTION 'People evaluation successor mismatch' USING ERRCODE='23514'; END IF;
    FOREACH section IN ARRAY ARRAY['presentation','execution','coverage'] LOOP
      IF NEW.section_scores->>section IS NULL THEN missing:=true;
      ELSE
        IF jsonb_typeof(NEW.section_scores->section) IS DISTINCT FROM 'string'
          OR (NEW.section_scores->>section)::numeric NOT BETWEEN 0 AND 100 THEN
          RAISE EXCEPTION 'People observed section invalid' USING ERRCODE='23514';
        END IF;
        weighted:=weighted+(NEW.section_scores->>section)::numeric*(rubric.weights->>section)::numeric/100;
      END IF;
    END LOOP;
    FOR item IN SELECT * FROM jsonb_array_elements(rubric.critical_checks) LOOP
      IF NEW.critical_responses->>(item#>>'{}') IS NULL THEN missing:=true;
      ELSIF jsonb_typeof(NEW.critical_responses->(item#>>'{}')) IS DISTINCT FROM 'boolean' THEN
        RAISE EXCEPTION 'People critical answer invalid' USING ERRCODE='23514';
      ELSIF NEW.critical_responses->(item#>>'{}')='false'::jsonb THEN failed:=true;
      END IF;
    END LOOP;
    expected_outcome:=CASE WHEN missing THEN 'incomplete' WHEN failed THEN 'critical_failure'
      WHEN weighted>=rubric.pass_threshold THEN 'pass' ELSE 'low' END;
    IF NEW.outcome IS DISTINCT FROM expected_outcome
      OR NEW.score IS DISTINCT FROM (CASE WHEN missing THEN NULL ELSE weighted END) THEN
      RAISE EXCEPTION 'People pinned evaluation score mismatch' USING ERRCODE='23514';
    END IF;
  WHEN 'people_evaluationvoid' THEN
    IF NOT EXISTS(SELECT 1 FROM people_evaluationattempt attempt
      WHERE attempt.id=NEW.attempt_id AND attempt.evaluation_id=NEW.evaluation_id
        AND attempt.revision=NEW.revision-1)
      OR EXISTS(SELECT 1 FROM people_evaluationattempt WHERE evaluation_id=NEW.evaluation_id AND revision>=NEW.revision)
    THEN RAISE EXCEPTION 'People evaluation void mismatch' USING ERRCODE='23514'; END IF;
  WHEN 'people_evaluationcompletion' THEN
    SELECT * INTO observation FROM people_evaluationattempt WHERE id=NEW.attempt_id;
    SELECT * INTO evaluation FROM people_evaluation WHERE id=observation.evaluation_id;
    SELECT COALESCE(max(sequence),0)+1 INTO expected_revision FROM people_evaluationcompletion
      WHERE organization_id=NEW.organization_id AND subject_id=NEW.subject_id;
    IF NEW.sequence<>expected_revision OR observation.outcome='incomplete'
      OR observation.created_by_id<>NEW.created_by_id OR evaluation.subject_id<>NEW.subject_id THEN
      RAISE EXCEPTION 'People completion sequence mismatch' USING ERRCODE='23514';
    END IF;
  WHEN 'people_evaluationnoticepolicyversion' THEN
    SELECT COALESCE(max(revision),0)+1 INTO expected_revision
      FROM people_evaluationnoticepolicyversion WHERE organization_id=NEW.organization_id
        AND center_id=NEW.center_id AND quadrant_id IS NOT DISTINCT FROM NEW.quadrant_id;
    IF NEW.revision<>expected_revision THEN
      RAISE EXCEPTION 'People notice policy revision mismatch' USING ERRCODE='23514';
    END IF;
  WHEN 'people_trainingnoticecause' THEN
    IF jsonb_typeof(NEW.contexts) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.contexts)=0
      OR jsonb_typeof(NEW.policy_ids) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'People notice contexts missing' USING ERRCODE='23514';
    END IF;
    IF NEW.kind='third_adverse' THEN
      SELECT * INTO parent FROM people_evaluationcompletion WHERE id=NEW.completion_id;
      SELECT COALESCE(max(prior.sequence),0) INTO previous_pass
        FROM people_evaluationcompletion prior JOIN people_evaluationattempt attempt ON attempt.id=prior.attempt_id
        WHERE prior.organization_id=NEW.organization_id AND prior.subject_id=NEW.subject_id
          AND prior.sequence<=parent.sequence AND attempt.outcome='pass'
          AND NOT EXISTS(SELECT 1 FROM people_evaluationattempt successor WHERE successor.predecessor_id=attempt.id)
          AND NOT EXISTS(SELECT 1 FROM people_evaluationvoid WHERE evaluation_id=attempt.evaluation_id);
      SELECT array_agg(prior.id ORDER BY prior.sequence) INTO episode
        FROM people_evaluationcompletion prior JOIN people_evaluationattempt attempt ON attempt.id=prior.attempt_id
        WHERE prior.organization_id=NEW.organization_id AND prior.subject_id=NEW.subject_id
          AND prior.sequence>previous_pass AND prior.sequence<=parent.sequence
          AND attempt.outcome IN ('low','critical_failure')
          AND NOT EXISTS(SELECT 1 FROM people_evaluationattempt successor WHERE successor.predecessor_id=attempt.id)
          AND NOT EXISTS(SELECT 1 FROM people_evaluationvoid WHERE evaluation_id=attempt.evaluation_id);
      IF parent.subject_id<>NEW.subject_id OR parent.created_by_id IS DISTINCT FROM NEW.created_by_id
        OR cardinality(episode) IS DISTINCT FROM 3 OR episode[1] IS DISTINCT FROM NEW.episode_start_id
        OR episode[3] IS DISTINCT FROM NEW.completion_id THEN
        RAISE EXCEPTION 'People third-adverse cause mismatch' USING ERRCODE='23514';
      END IF;
      IF EXISTS(SELECT 1 FROM unnest(episode) completion_id
        JOIN people_evaluationcompletion c ON c.id=completion_id
        JOIN people_evaluationattempt a ON a.id=c.attempt_id JOIN people_evaluation e ON e.id=a.evaluation_id
        WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.contexts) bound
          WHERE bound->>'center_id'=e.center_id::text
            AND bound->>'quadrant_id' IS NOT DISTINCT FROM e.quadrant_id::text))
        OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.contexts) bound
          WHERE NOT EXISTS(SELECT 1 FROM people_evaluationcompletion c
            JOIN people_evaluationattempt a ON a.id=c.attempt_id JOIN people_evaluation e ON e.id=a.evaluation_id
            WHERE c.id=ANY(episode) AND bound->>'center_id'=e.center_id::text
              AND bound->>'quadrant_id' IS NOT DISTINCT FROM e.quadrant_id::text))
      THEN RAISE EXCEPTION 'People episode context mismatch' USING ERRCODE='23514'; END IF;
    ELSE
      SELECT * INTO certificate FROM people_certification WHERE id=NEW.certification_id;
      IF certificate.subject_id<>NEW.subject_id OR NEW.due_at<>certificate.valid_to
        OR NEW.actor_kind<>'system' OR NEW.created_at<NEW.due_at
        OR NEW.contexts<>jsonb_build_array(jsonb_build_object('center_id',certificate.center_id::text,
          'quadrant_id',certificate.quadrant_id::text)) OR NEW.policy_ids<>'[]'::jsonb THEN
        RAISE EXCEPTION 'People expiry cause mismatch' USING ERRCODE='23514';
      END IF;
    END IF;
  WHEN 'people_trainingnoticeintent' THEN
    SELECT * INTO cause FROM people_trainingnoticecause WHERE id=NEW.cause_id;
    IF NEW.reroutes_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM people_trainingnoticeintent previous WHERE id=NEW.reroutes_id
        AND cause_id=NEW.cause_id AND organization_id=NEW.organization_id) THEN
      RAISE EXCEPTION 'People notice intent predecessor mismatch' USING ERRCODE='23514';
    END IF;
    IF cause.kind='certification_expired' THEN
      IF NEW.policy_id IS NOT NULL OR NEW.policy_ids<>'[]'::jsonb OR NOT EXISTS(
        SELECT 1 FROM organizations_membership WHERE id=NEW.recipient_membership_id AND user_id=cause.subject_id) THEN
        RAISE EXCEPTION 'People expiry recipient mismatch' USING ERRCODE='23514';
      END IF;
    ELSE
      required_contexts:=people_notice_contexts(cause.id);
      IF jsonb_typeof(NEW.policy_ids) IS DISTINCT FROM 'array'
        OR jsonb_array_length(NEW.policy_ids)<>jsonb_array_length(required_contexts)
        OR (NEW.policy_id IS NOT NULL AND NOT NEW.policy_ids ? NEW.policy_id::text) THEN
        RAISE EXCEPTION 'People HR recipient policy missing' USING ERRCODE='23514';
      END IF;
      FOR context IN SELECT * FROM jsonb_array_elements(required_contexts) LOOP
        IF NOT EXISTS(SELECT 1 FROM people_evaluationnoticepolicyversion policy
          WHERE policy.id::text IN (SELECT jsonb_array_elements_text(NEW.policy_ids))
            AND policy.organization_id=NEW.organization_id
            AND policy.recipient_membership_id=NEW.recipient_membership_id
            AND policy.center_id::text=context->>'center_id'
            AND policy.quadrant_id::text IS NOT DISTINCT FROM context->>'quadrant_id') THEN
          RAISE EXCEPTION 'People HR recipient policy mismatch' USING ERRCODE='23514';
        END IF;
      END LOOP;
    END IF;
  WHEN 'people_trainingnoticepublication' THEN
    SELECT * INTO cause FROM people_trainingnoticecause WHERE id=NEW.cause_id;
    required_contexts:=people_notice_contexts(cause.id);
    SELECT policy_ids INTO pinned FROM people_trainingnoticeroute WHERE cause_id=cause.id ORDER BY revision DESC LIMIT 1;
    pinned:=COALESCE(pinned,cause.policy_ids);
    IF NEW.attempt_number<>(SELECT COALESCE(max(attempt_number),0)+1 FROM people_trainingnoticepublication WHERE cause_id=NEW.cause_id)
      OR NOT NEW.not_published OR NEW.status NOT IN ('recipient_unconfigured','recipient_unavailable','delivery_unavailable','superseded')
      OR jsonb_typeof(NEW.assessment) IS DISTINCT FROM 'object'
      OR NOT NEW.assessment ?& ARRAY['status','facts','policies','recipient_membership_id','contexts']
      OR NEW.assessment-ARRAY['status','facts','policies','recipient_membership_id','contexts']<>'{}'::jsonb
      OR jsonb_typeof(NEW.assessment->'facts') IS DISTINCT FROM 'array'
      OR jsonb_typeof(NEW.assessment->'policies') IS DISTINCT FROM 'array'
      OR jsonb_typeof(NEW.assessment->'contexts') IS DISTINCT FROM 'array'
      OR jsonb_typeof(NEW.assessment->'recipient_membership_id') NOT IN ('string','null')
      OR (NEW.assessment->>'recipient_membership_id' IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM organizations_membership WHERE organization_id=NEW.organization_id
          AND id::text=NEW.assessment->>'recipient_membership_id'))
      OR NEW.assessment->'policies' IS DISTINCT FROM pinned
      OR NEW.assessment->>'status' IS DISTINCT FROM NEW.status OR NEW.frame_hash!~'^[0-9a-f]{64}$'
      OR (NEW.status='delivery_unavailable') IS DISTINCT FROM (NEW.intent_id IS NOT NULL)
      OR (NEW.intent_id IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM people_trainingnoticeintent WHERE id=NEW.intent_id AND cause_id=NEW.cause_id
          AND recipient_membership_id::text=NEW.assessment->>'recipient_membership_id'))
    THEN RAISE EXCEPTION 'People notice publication mismatch' USING ERRCODE='23514'; END IF;
    IF jsonb_array_length(NEW.assessment->'contexts')<>jsonb_array_length(required_contexts)
      OR NOT (NEW.assessment->'contexts' @> required_contexts AND required_contexts @> NEW.assessment->'contexts')
    THEN RAISE EXCEPTION 'People notice publication context mismatch' USING ERRCODE='23514'; END IF;
    IF cause.kind='certification_expired' THEN
      IF NEW.assessment->'facts' IS DISTINCT FROM jsonb_build_array(cause.certification_id::text)
        OR NEW.assessment->'policies'<>'[]'::jsonb THEN
        RAISE EXCEPTION 'People expiry publication mismatch' USING ERRCODE='23514';
      END IF;
    ELSE
      SELECT COALESCE(max(prior.sequence),0) INTO previous_pass
        FROM people_evaluationcompletion prior JOIN people_evaluationattempt a ON a.id=prior.attempt_id
        WHERE prior.organization_id=NEW.organization_id AND prior.subject_id=cause.subject_id AND a.outcome='pass'
          AND NOT EXISTS(SELECT 1 FROM people_evaluationattempt successor WHERE successor.predecessor_id=a.id)
          AND NOT EXISTS(SELECT 1 FROM people_evaluationvoid WHERE evaluation_id=a.evaluation_id);
      SELECT array_agg(prior.id ORDER BY prior.sequence) INTO episode
        FROM people_evaluationcompletion prior JOIN people_evaluationattempt a ON a.id=prior.attempt_id
        WHERE prior.organization_id=NEW.organization_id AND prior.subject_id=cause.subject_id
          AND prior.sequence>previous_pass AND a.outcome IN ('low','critical_failure')
          AND NOT EXISTS(SELECT 1 FROM people_evaluationattempt successor WHERE successor.predecessor_id=a.id)
          AND NOT EXISTS(SELECT 1 FROM people_evaluationvoid WHERE evaluation_id=a.evaluation_id);
      IF NEW.assessment->'facts' IS DISTINCT FROM COALESCE(to_jsonb(episode),'[]'::jsonb) THEN
        RAISE EXCEPTION 'People current notice publication facts mismatch' USING ERRCODE='23514';
      END IF;
      IF NEW.intent_id IS NOT NULL THEN
        FOR context IN SELECT * FROM jsonb_array_elements(required_contexts) LOOP
          IF NOT EXISTS(SELECT 1 FROM people_evaluationnoticepolicyversion policy
            JOIN people_trainingnoticeintent intent ON intent.id=NEW.intent_id
            WHERE policy.id::text IN (SELECT jsonb_array_elements_text(NEW.assessment->'policies'))
              AND policy.organization_id=NEW.organization_id
              AND policy.recipient_membership_id=intent.recipient_membership_id
              AND policy.center_id::text=context->>'center_id'
              AND policy.quadrant_id::text IS NOT DISTINCT FROM context->>'quadrant_id') THEN
            RAISE EXCEPTION 'People notice publication recipient context mismatch' USING ERRCODE='23514';
          END IF;
        END LOOP;
      END IF;
    END IF;
  WHEN 'people_trainingnoticeroute' THEN
    SELECT * INTO cause FROM people_trainingnoticecause WHERE id=NEW.cause_id;
    required_contexts:=people_notice_contexts(cause.id);
    SELECT COALESCE(max(prior.sequence),0) INTO previous_pass
      FROM people_evaluationcompletion prior JOIN people_evaluationattempt a ON a.id=prior.attempt_id
      WHERE prior.organization_id=NEW.organization_id AND prior.subject_id=cause.subject_id AND a.outcome='pass'
        AND NOT EXISTS(SELECT 1 FROM people_evaluationattempt successor WHERE successor.predecessor_id=a.id)
        AND NOT EXISTS(SELECT 1 FROM people_evaluationvoid WHERE evaluation_id=a.evaluation_id);
    SELECT array_agg(prior.id ORDER BY prior.sequence) INTO episode
      FROM people_evaluationcompletion prior JOIN people_evaluationattempt a ON a.id=prior.attempt_id
      WHERE prior.organization_id=NEW.organization_id AND prior.subject_id=cause.subject_id
        AND prior.sequence>previous_pass AND a.outcome IN ('low','critical_failure')
        AND NOT EXISTS(SELECT 1 FROM people_evaluationattempt successor WHERE successor.predecessor_id=a.id)
        AND NOT EXISTS(SELECT 1 FROM people_evaluationvoid WHERE evaluation_id=a.evaluation_id);
    IF NEW.revision<>(SELECT COALESCE(max(revision),0)+1 FROM people_trainingnoticeroute WHERE cause_id=NEW.cause_id)
      OR cause.kind<>'third_adverse' OR COALESCE(cardinality(episode),0)<3
      OR episode[1] IS DISTINCT FROM cause.episode_start_id
      OR (NEW.predecessor_id IS NULL) IS DISTINCT FROM (NEW.revision=1)
      OR (NEW.predecessor_id IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM people_trainingnoticeroute WHERE id=NEW.predecessor_id
          AND cause_id=NEW.cause_id AND revision=NEW.revision-1 AND organization_id=NEW.organization_id))
      OR NOT EXISTS(SELECT 1 FROM people_trainingnoticeintent WHERE id=NEW.intent_id AND cause_id=NEW.cause_id)
      OR NOT EXISTS(SELECT 1 FROM people_trainingnoticepublication WHERE cause_id=NEW.cause_id
        AND status IN ('recipient_unconfigured','recipient_unavailable','delivery_unavailable') AND not_published)
      OR (SELECT status FROM people_trainingnoticepublication WHERE cause_id=NEW.cause_id ORDER BY attempt_number DESC LIMIT 1)
        NOT IN ('recipient_unconfigured','recipient_unavailable','delivery_unavailable')
      OR EXISTS(SELECT 1 FROM people_trainingnoticepublication WHERE cause_id=NEW.cause_id AND NOT not_published)
      OR jsonb_typeof(NEW.policy_ids) IS DISTINCT FROM 'array'
    THEN RAISE EXCEPTION 'People pending notice route mismatch' USING ERRCODE='23514'; END IF;
    IF jsonb_array_length(NEW.policy_ids)<>jsonb_array_length(required_contexts) THEN
      RAISE EXCEPTION 'People route context policy missing' USING ERRCODE='23514';
    END IF;
    FOR context IN SELECT * FROM jsonb_array_elements(required_contexts) LOOP
      IF NOT EXISTS(SELECT 1 FROM people_evaluationnoticepolicyversion policy
        JOIN people_trainingnoticeintent intent ON intent.id=NEW.intent_id
        WHERE policy.id::text IN (SELECT jsonb_array_elements_text(NEW.policy_ids))
          AND policy.organization_id=NEW.organization_id
          AND policy.recipient_membership_id=intent.recipient_membership_id
          AND policy.center_id::text=context->>'center_id'
          AND policy.quadrant_id::text IS NOT DISTINCT FROM context->>'quadrant_id') THEN
        RAISE EXCEPTION 'People route context policy mismatch' USING ERRCODE='23514';
      END IF;
    END LOOP;
  WHEN 'people_eligibilityassessmentreceipt' THEN
    IF NEW.created_by_id IS DISTINCT FROM NEW.subject_id
      OR NOT EXISTS(SELECT 1 FROM accounts_devicesession session
        JOIN accounts_tokenpair pair ON pair.session_id=session.id
        WHERE session.id=NEW.session_id AND session.user_id=NEW.subject_id
          AND session.organization_id=NEW.organization_id AND pair.id=NEW.pair_id
          AND pair.organization_id=NEW.organization_id AND pair.access_expires_at>NEW.created_at
          AND session.revoked_at IS NULL
          AND session.ended_at IS NULL AND session.dissociated_at IS NULL)
      OR NEW.semantic_hash!~'^[0-9a-f]{64}$' OR NEW.scope_revision!~'^[0-9a-f]{64}$'
      OR jsonb_typeof(NEW.assessment) IS DISTINCT FROM 'object'
      OR NOT NEW.assessment ?& ARRAY['subject_id','action','center_id','quadrant_id','training_eligible',
        'requirement_version_id','certification_ids','training_version_ids','revocation_ids',
        'valid_from','valid_until','next_change_at','blockers']
      OR jsonb_typeof(NEW.assessment->'training_eligible') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(NEW.assessment->'certification_ids') IS DISTINCT FROM 'array'
      OR jsonb_typeof(NEW.assessment->'training_version_ids') IS DISTINCT FROM 'array'
      OR jsonb_typeof(NEW.assessment->'revocation_ids') IS DISTINCT FROM 'array'
      OR jsonb_typeof(NEW.assessment->'blockers') IS DISTINCT FROM 'array'
      OR NEW.valid_from IS DISTINCT FROM (NEW.assessment->>'valid_from')::timestamptz
      OR NEW.valid_until IS DISTINCT FROM (NEW.assessment->>'valid_until')::timestamptz
      OR NEW.assessment->>'subject_id' IS DISTINCT FROM NEW.subject_id::text
      OR NEW.assessment->>'action' IS DISTINCT FROM NEW.action
      OR NEW.assessment->>'center_id' IS DISTINCT FROM NEW.center_id::text
      OR NEW.assessment->>'quadrant_id' IS DISTINCT FROM NEW.quadrant_id::text
      OR jsonb_typeof(NEW.authority) IS DISTINCT FROM 'object'
      OR NEW.authority->'permission_codes' IS DISTINCT FROM '["field.bootstrap","field_event.sync"]'::jsonb
      OR NEW.authority->>'scope_revision' IS DISTINCT FROM NEW.scope_revision
      OR NEW.authority->>'center_id' IS DISTINCT FROM NEW.center_id::text
      OR NEW.authority->>'quadrant_id' IS DISTINCT FROM NEW.quadrant_id::text
    THEN RAISE EXCEPTION 'People genuine assessment context mismatch' USING ERRCODE='23514'; END IF;
    IF NEW.assessment->'training_eligible'='true'::jsonb THEN
      SELECT * INTO parent FROM people_actiontrainingrequirementversion requirement
        WHERE requirement.organization_id=NEW.organization_id AND requirement.action=NEW.action
          AND requirement.center_id=NEW.center_id AND requirement.quadrant_id IS NOT DISTINCT FROM NEW.quadrant_id
          AND requirement.effective_from<=NEW.created_at AND requirement.created_at<=NEW.created_at
        ORDER BY requirement.effective_from DESC,requirement.revision DESC LIMIT 1;
      IF parent.id IS NULL OR parent.id::text IS DISTINCT FROM NEW.assessment->>'requirement_version_id'
        OR NEW.assessment->'blockers'<>'[]'::jsonb OR NEW.valid_from IS NULL OR NEW.valid_until IS NULL
        OR NEW.valid_from>NEW.created_at OR NEW.valid_until<=NEW.created_at
        OR jsonb_array_length(NEW.assessment->'certification_ids')<>(SELECT count(*) FROM jsonb_each(parent.acceptable_versions))
        OR jsonb_array_length(NEW.assessment->'training_version_ids')<>jsonb_array_length(NEW.assessment->'certification_ids')
      THEN RAISE EXCEPTION 'People qualified assessment requirement mismatch' USING ERRCODE='23514'; END IF;
      FOR named IN SELECT * FROM jsonb_each(parent.acceptable_versions) LOOP
        IF NOT EXISTS(SELECT 1 FROM people_certification cert
          JOIN people_trainingversion version ON version.id=cert.training_version_id
          WHERE cert.id::text IN (SELECT jsonb_array_elements_text(NEW.assessment->'certification_ids'))
            AND cert.organization_id=NEW.organization_id AND cert.subject_id=NEW.subject_id
            AND cert.center_id=NEW.center_id AND cert.quadrant_id IS NOT DISTINCT FROM NEW.quadrant_id
            AND cert.created_at<=NEW.created_at AND cert.valid_from<=NEW.created_at AND cert.valid_to>NEW.created_at
            AND version.organization_id=NEW.organization_id AND version.training_id=named.key::uuid
            AND named.value ? version.id::text AND version.is_active AND version.enabled_actions ? NEW.action
            AND version.effective_from<=NEW.created_at AND version.created_at<=NEW.created_at
            AND NEW.assessment->'training_version_ids' ? version.id::text
            AND NEW.valid_from>=GREATEST(cert.valid_from,version.effective_from,parent.effective_from)
            AND NEW.valid_until<=cert.valid_to
            AND NOT EXISTS(SELECT 1 FROM people_certificationrevocation revoked
              WHERE revoked.certification_id=cert.id AND revoked.created_at<=NEW.created_at
                AND revoked.effective_from<=NEW.created_at)) THEN
          RAISE EXCEPTION 'People qualified assessment certification mismatch' USING ERRCODE='23514';
        END IF;
      END LOOP;
    END IF;
  WHEN 'people_peoplecommand' THEN
    IF NEW.operation NOT IN ('training.create','training.version','requirement.version',
      'certification.issue','certification.revoke','rubric.create','rubric.version',
      'evaluation.create','evaluation.revise','evaluation.void','notice_policy.version')
      OR NEW.body_hash!~'^[0-9a-f]{64}$'
      OR jsonb_typeof(NEW.response) IS DISTINCT FROM 'object'
      OR NEW.response->>'command_id' IS DISTINCT FROM NEW.command_id::text
      OR NOT NEW.response ?& ARRAY['command_id','id','revision','recorded_at','evaluation']
      OR jsonb_typeof(NEW.subjects) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.subjects)=0
      OR EXISTS(SELECT 1 FROM people_peoplecommand previous
        WHERE previous.organization_id=NEW.organization_id AND previous.operation=NEW.operation
          AND previous.response->>'id'=NEW.response->>'id'
          AND previous.response->'revision'=NEW.response->'revision')
    THEN RAISE EXCEPTION 'People command receipt mismatch' USING ERRCODE='23514'; END IF;
  ELSE NULL;
  END CASE;
  RETURN NEW;
END; $$;

CREATE FUNCTION people_complete_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE facts jsonb := to_jsonb(NEW); expected_operation text; identity uuid; attempt uuid; revision bigint;
        command people_peoplecommand; target_table text; target jsonb; selected record; field text;
BEGIN
  CASE TG_TABLE_NAME
  WHEN 'people_training' THEN expected_operation:='training.create'; identity:=NEW.id; revision:=0;
  WHEN 'people_trainingversion' THEN expected_operation:='training.version'; identity:=NEW.id; revision:=NEW.version;
  WHEN 'people_actiontrainingrequirementversion' THEN expected_operation:='requirement.version'; identity:=NEW.id; revision:=NEW.revision;
  WHEN 'people_certification' THEN expected_operation:='certification.issue'; identity:=NEW.id; revision:=1;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(NEW.evidence_ids) evidence_id WHERE NOT EXISTS(
      SELECT 1 FROM uploads_upload upload JOIN uploads_uploadverification verified ON verified.upload_id=upload.id
        JOIN uploads_attachmentlink link ON link.upload_id=upload.id
      WHERE upload.public_id::text=evidence_id AND upload.organization_id=NEW.organization_id
        AND upload.uploader_id=NEW.created_by_id AND verified.organization_id=NEW.organization_id
        AND link.organization_id=NEW.organization_id AND link.certification_id=NEW.id
        AND link.created_by_id=NEW.created_by_id))
      OR EXISTS(SELECT 1 FROM uploads_attachmentlink link JOIN uploads_upload upload ON upload.id=link.upload_id
        WHERE link.certification_id=NEW.id AND NOT NEW.evidence_ids ? upload.public_id::text)
    THEN RAISE EXCEPTION 'People certification evidence incomplete' USING ERRCODE='23514'; END IF;
  WHEN 'people_certificationrevocation' THEN expected_operation:='certification.revoke'; identity:=NEW.id; revision:=NEW.revision;
  WHEN 'people_evaluationrubric' THEN expected_operation:='rubric.create'; identity:=NEW.id; revision:=0;
  WHEN 'people_evaluationrubricversion' THEN expected_operation:='rubric.version'; identity:=NEW.id; revision:=NEW.version;
  WHEN 'people_evaluation' THEN expected_operation:='evaluation.create'; identity:=NEW.id; revision:=1;
    IF NOT EXISTS(SELECT 1 FROM people_evaluationattempt WHERE evaluation_id=NEW.id AND revision=1) THEN
      RAISE EXCEPTION 'People evaluation initial attempt missing' USING ERRCODE='23514';
    END IF;
  WHEN 'people_evaluationattempt' THEN
    expected_operation:=CASE WHEN NEW.revision=1 THEN 'evaluation.create' ELSE 'evaluation.revise' END;
    identity:=NEW.evaluation_id; revision:=NEW.revision; attempt:=NEW.id;
    IF (NEW.outcome<>'incomplete') IS DISTINCT FROM EXISTS(
      SELECT 1 FROM people_evaluationcompletion WHERE attempt_id=NEW.id) THEN
      RAISE EXCEPTION 'People evaluation completion incomplete' USING ERRCODE='23514';
    END IF;
  WHEN 'people_evaluationvoid' THEN expected_operation:='evaluation.void'; identity:=NEW.id; revision:=NEW.revision;
  WHEN 'people_evaluationnoticepolicyversion' THEN expected_operation:='notice_policy.version'; identity:=NEW.id; revision:=NEW.revision;
  WHEN 'people_trainingnoticeroute' THEN
    IF NOT EXISTS(SELECT 1 FROM people_peoplecommand WHERE organization_id=NEW.organization_id
      AND created_by_id=NEW.created_by_id AND command_id=NEW.command_id AND operation='notice_policy.version'
      AND NEW.policy_ids ? (response->>'id')) THEN
      RAISE EXCEPTION 'People notice route command incomplete' USING ERRCODE='23514';
    END IF;
  WHEN 'people_eligibilityassessmentreceipt' THEN
    IF NOT EXISTS(SELECT 1 FROM field_sync_courierchange change
      WHERE change.organization_id=NEW.organization_id AND change.courier_id=NEW.subject_id
        AND change.sequence=NEW.publication_sequence AND change.kind='eligibility'
        AND change.resource_type='training_eligibility'
        AND change.payload->>'assessment_receipt'=NEW.id::text
        AND change.payload->>'subject_id'=NEW.subject_id::text
        AND change.payload->>'action'=NEW.action
        AND change.scope->>'center_id'=NEW.center_id::text
        AND change.scope->>'quadrant_id' IS NOT DISTINCT FROM NEW.quadrant_id::text
        AND change.payload - ARRAY['id','organization_id','assessment_receipt','version']=NEW.assessment)
    THEN RAISE EXCEPTION 'People assessment publication incomplete' USING ERRCODE='23514'; END IF;
  WHEN 'people_peoplecommand' THEN
    target_table:=CASE NEW.operation
      WHEN 'training.create' THEN 'people_training' WHEN 'training.version' THEN 'people_trainingversion'
      WHEN 'requirement.version' THEN 'people_actiontrainingrequirementversion'
      WHEN 'certification.issue' THEN 'people_certification' WHEN 'certification.revoke' THEN 'people_certificationrevocation'
      WHEN 'rubric.create' THEN 'people_evaluationrubric' WHEN 'rubric.version' THEN 'people_evaluationrubricversion'
      WHEN 'evaluation.create' THEN 'people_evaluation' WHEN 'evaluation.revise' THEN 'people_evaluation'
      WHEN 'evaluation.void' THEN 'people_evaluationvoid' WHEN 'notice_policy.version' THEN 'people_evaluationnoticepolicyversion' END;
    EXECUTE format('SELECT to_jsonb(fact) FROM %I fact WHERE id=$1 AND organization_id=$2',target_table)
      INTO target USING (NEW.response->>'id')::uuid,NEW.organization_id;
    IF target IS NULL OR (NEW.operation<>'evaluation.revise' AND target->>'created_by_id' IS DISTINCT FROM NEW.created_by_id::text)
      OR (NEW.response->>'recorded_at')::timestamptz IS DISTINCT FROM (target->>'created_at')::timestamptz
      OR (NEW.operation='training.version' AND NEW.target_id IS DISTINCT FROM (target->>'training_id')::uuid)
      OR (NEW.operation='rubric.version' AND NEW.target_id IS DISTINCT FROM (target->>'rubric_id')::uuid)
      OR (NEW.operation='certification.revoke' AND NEW.target_id IS DISTINCT FROM (target->>'certification_id')::uuid)
      OR (NEW.operation IN ('evaluation.revise','evaluation.void') AND NEW.target_id IS DISTINCT FROM
        (CASE WHEN NEW.operation='evaluation.revise' THEN target->>'id' ELSE target->>'evaluation_id' END)::uuid)
    THEN RAISE EXCEPTION 'People command actual target incomplete' USING ERRCODE='23514'; END IF;
    IF NEW.operation IN ('evaluation.create','evaluation.revise') AND NOT EXISTS(
      SELECT 1 FROM people_evaluationattempt observed LEFT JOIN people_evaluationcompletion completion ON completion.attempt_id=observed.id
      WHERE observed.id::text=NEW.response->'evaluation'->>'attempt_id'
        AND observed.evaluation_id::text=NEW.response->>'id' AND observed.created_by_id=NEW.created_by_id
        AND observed.revision::text=NEW.response->>'revision'
        AND observed.outcome=NEW.response->'evaluation'->>'outcome'
        AND observed.score IS NOT DISTINCT FROM (NEW.response->'evaluation'->>'score')::numeric
        AND completion.sequence IS NOT DISTINCT FROM (NEW.response->'evaluation'->>'completion_sequence')::bigint)
    THEN RAISE EXCEPTION 'People command evaluation receipt incomplete' USING ERRCODE='23514'; END IF;
  ELSE NULL;
  END CASE;
  IF expected_operation IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM people_peoplecommand receipt
    WHERE receipt.organization_id=NEW.organization_id AND receipt.created_by_id=NEW.created_by_id
      AND receipt.operation=expected_operation AND receipt.response->>'id'=identity::text
      AND receipt.response->'revision'=to_jsonb(revision)
      AND (attempt IS NULL OR receipt.response->'evaluation'->>'attempt_id'=attempt::text)
  ) THEN RAISE EXCEPTION 'People fact command incomplete' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END; $$;
"""

FORWARD_SQL = GUARDS + "\n".join(
    f"CREATE TRIGGER {table}_fact_guard BEFORE INSERT OR UPDATE OR DELETE ON {table} "
    f"FOR EACH ROW EXECUTE FUNCTION people_fact_guard();"
    f"CREATE CONSTRAINT TRIGGER {table}_complete_guard AFTER INSERT ON {table} "
    f"DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION people_complete_guard();"
    for table in TABLES
)
REVERSE_SQL = (
    "\n".join(
        f"DROP TRIGGER {table}_complete_guard ON {table}; DROP TRIGGER {table}_fact_guard ON {table};"
        for table in reversed(TABLES)
    )
    + "\nDROP FUNCTION people_complete_guard(); DROP FUNCTION people_fact_guard(); DROP FUNCTION people_notice_contexts(uuid);"
)


def protect_reverse(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    with schema_editor.connection.cursor() as cursor:
        for table in TABLES:
            cursor.execute(f'SELECT EXISTS(SELECT 1 FROM "{table}")')  # noqa: S608 -- immutable closed migration table registry.
            if cursor.fetchone()[0]:
                raise IrreversibleError(
                    "Retain people qualification, evaluation and publication audit."
                )


class Migration(migrations.Migration):
    dependencies = [
        ("people", "0001_people_certification_parent"),
        ("uploads", "0007_people_certification_parent"),
        ("field_sync", "0006_bundle_producer_kinds"),
    ]
    operations = [
        migrations.RunSQL(FORWARD_SQL, REVERSE_SQL),
        migrations.RunPython(migrations.RunPython.noop, protect_reverse),
    ]
