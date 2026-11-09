"""Append-only B34 relational guards and same-transaction completion, no backfill."""

from django.db import migrations

TABLES = (
    "community_communityactivity",
    "community_communityactivityevent",
    "community_communitycommandreceipt",
    "community_communitysourcelink",
    "community_complaintincidentlink",
    "community_communitysourcecancellation",
)

GUARDS = r"""
CREATE FUNCTION community_fact_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE activity community_communityactivity; event community_communityactivityevent;
        source field_sync_fieldevent; target field_sync_fieldevent;
        response_clock timestamptz;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Community facts are insert only' USING ERRCODE='23514';
  END IF;
  IF NEW.created_by_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM organizations_membership m WHERE m.organization_id=NEW.organization_id AND m.user_id=NEW.created_by_id
  ) THEN RAISE EXCEPTION 'Community author tenant mismatch' USING ERRCODE='23514'; END IF;
  CASE TG_TABLE_NAME
  WHEN 'community_communityactivity' THEN
    IF NOT EXISTS (
      SELECT 1 FROM geography_block b
      JOIN geography_quadrant q ON q.id=b.quadrant_id
      JOIN organizations_center c ON c.id=q.center_id
      JOIN geography_blockversion v ON v.id=NEW.zone_version_id AND v.block_id=b.id
      JOIN catalogs_catalogitem i ON i.id=NEW.type_id
      JOIN catalogs_catalog cat ON cat.id=i.catalog_id
      WHERE b.id=NEW.zone_id AND b.organization_id=NEW.organization_id
        AND q.organization_id=NEW.organization_id AND c.organization_id=NEW.organization_id
        AND v.organization_id=NEW.organization_id AND i.organization_id=NEW.organization_id
        AND cat.organization_id=NEW.organization_id AND cat.slug='community-activity-type'
        AND NOT i.requires_photo AND NEW.type_snapshot->>'code'=i.code
    ) OR jsonb_typeof(NEW.type_snapshot)<>'object'
      OR NOT NEW.type_snapshot ?& ARRAY['code','label_es','label_en','is_other','requires_photo']
      OR NEW.type_snapshot->'requires_photo'<>'false'::jsonb
      OR char_length(NEW.agreements)>1000 OR char_length(NEW.other_text)>1000
    THEN RAISE EXCEPTION 'Community capture parent mismatch' USING ERRCODE='23514'; END IF;
  WHEN 'community_communityactivityevent' THEN
    SELECT * INTO activity FROM community_communityactivity WHERE id=NEW.activity_id;
    IF activity.id IS NULL OR activity.organization_id<>NEW.organization_id
      OR (NEW.action='create' AND (NEW.command_id<>activity.id OR NEW.created_by_id<>activity.created_by_id))
      OR (NEW.action='void' AND NOT EXISTS (SELECT 1 FROM community_communityactivityevent WHERE activity_id=activity.id AND action='create'))
      OR char_length(NEW.body_hash)<>64 OR char_length(NEW.reason)>1000
    THEN RAISE EXCEPTION 'Community event identity mismatch' USING ERRCODE='23514'; END IF;
    IF NEW.origin='field' AND (NEW.declared_source_uuid<>NEW.command_id OR char_length(NEW.source_payload_hash)<>64) THEN
      RAISE EXCEPTION 'Community source command mismatch' USING ERRCODE='23514';
    END IF;
  WHEN 'community_communitycommandreceipt' THEN
    SELECT * INTO event FROM community_communityactivityevent WHERE id=NEW.event_id;
    SELECT * INTO activity FROM community_communityactivity WHERE id=event.activity_id;
    IF event.id IS NULL OR event.organization_id<>NEW.organization_id OR event.created_by_id<>NEW.created_by_id
      OR event.command_id<>NEW.command_id OR event.action<>NEW.operation OR event.origin<>NEW.origin
      OR event.body_hash<>NEW.body_hash OR event.activity_id<>NEW.target_id
      OR jsonb_typeof(NEW.response) IS DISTINCT FROM 'object'
      OR NOT NEW.response ?& ARRAY['activity_id','event_id','command_id','code','revision','server_received_at']
      OR (NEW.response - ARRAY['activity_id','event_id','command_id','code','revision','server_received_at']) IS DISTINCT FROM '{}'::jsonb
      OR jsonb_typeof(NEW.response->'activity_id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(NEW.response->'event_id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(NEW.response->'command_id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(NEW.response->'code') IS DISTINCT FROM 'string'
      OR jsonb_typeof(NEW.response->'server_received_at') IS DISTINCT FROM 'string'
      OR NEW.response->>'activity_id' IS DISTINCT FROM activity.id::text
      OR NEW.response->>'event_id' IS DISTINCT FROM event.id::text
      OR NEW.response->>'command_id' IS DISTINCT FROM event.command_id::text
      OR NEW.response->>'code' IS DISTINCT FROM activity.code
      OR NEW.response->'revision' IS DISTINCT FROM to_jsonb(event.revision)
      OR jsonb_typeof(NEW.command) IS DISTINCT FROM 'object'
    THEN RAISE EXCEPTION 'Community receipt mismatch' USING ERRCODE='23514'; END IF;
    BEGIN
      response_clock:=(NEW.response->>'server_received_at')::timestamptz;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RAISE EXCEPTION 'Community receipt clock mismatch' USING ERRCODE='23514';
    END;
    IF response_clock IS DISTINCT FROM event.server_received_at THEN
      RAISE EXCEPTION 'Community receipt clock mismatch' USING ERRCODE='23514';
    END IF;
    IF event.action='create' AND (
      NOT NEW.command ?& ARRAY['type_id','zone_id','attendance','agreements','other_text','incident_id']
      OR (NEW.command - ARRAY['type_id','zone_id','attendance','agreements','other_text','incident_id']) IS DISTINCT FROM '{}'::jsonb
      OR jsonb_typeof(NEW.command->'type_id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(NEW.command->'zone_id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(NEW.command->'agreements') IS DISTINCT FROM 'string'
      OR jsonb_typeof(NEW.command->'other_text') IS DISTINCT FROM 'string'
      OR (jsonb_typeof(NEW.command->'incident_id') IS DISTINCT FROM 'null'
        AND jsonb_typeof(NEW.command->'incident_id') IS DISTINCT FROM 'string')
      OR NEW.command->>'type_id' IS DISTINCT FROM activity.type_id::text
      OR NEW.command->>'zone_id' IS DISTINCT FROM activity.zone_id::text
      OR NEW.command->'attendance' IS DISTINCT FROM to_jsonb(activity.attendance)
      OR NEW.command->>'agreements' IS DISTINCT FROM activity.agreements
      OR NEW.command->>'other_text' IS DISTINCT FROM activity.other_text
      OR ((NEW.command->'incident_id' IS DISTINCT FROM 'null'::jsonb) IS DISTINCT FROM EXISTS (SELECT 1 FROM community_complaintincidentlink WHERE activity_id=activity.id))
      OR (NEW.command->'incident_id' IS DISTINCT FROM 'null'::jsonb AND NOT EXISTS (SELECT 1 FROM community_complaintincidentlink WHERE activity_id=activity.id AND incident_id::text=NEW.command->>'incident_id'))
    ) THEN RAISE EXCEPTION 'Community original command mismatch' USING ERRCODE='23514'; END IF;
    IF event.action='void' AND (
      NOT NEW.command ?& ARRAY['reason','reason_code']
      OR (NEW.command - ARRAY['reason','reason_code','expected_revision']) IS DISTINCT FROM '{}'::jsonb
      OR jsonb_typeof(NEW.command->'reason') IS DISTINCT FROM 'string'
      OR jsonb_typeof(NEW.command->'reason_code') IS DISTINCT FROM 'string'
      OR NEW.command->>'reason' IS DISTINCT FROM event.reason
      OR NEW.command->>'reason_code' IS DISTINCT FROM event.reason_code
      OR (NEW.command ? 'expected_revision' AND NEW.command->'expected_revision' IS DISTINCT FROM '1'::jsonb)
    ) THEN
      RAISE EXCEPTION 'Community void command mismatch' USING ERRCODE='23514';
    END IF;
  WHEN 'community_communitysourcelink' THEN
    SELECT * INTO event FROM community_communityactivityevent WHERE id=NEW.event_id;
    SELECT * INTO source FROM field_sync_fieldevent WHERE id=NEW.source_event_id;
    IF event.id IS NULL OR source.id IS NULL OR event.organization_id<>NEW.organization_id
      OR source.organization_id<>NEW.organization_id OR source.created_by_id<>NEW.created_by_id
      OR event.created_by_id<>NEW.created_by_id OR event.origin<>'field'
      OR event.declared_source_uuid<>source.id OR event.source_payload_hash<>source.payload_sha256
      OR event.device_time<>source.device_time OR event.server_received_at<>source.server_received_at
      OR NOT EXISTS (SELECT 1 FROM reviews_reviewsourcesnapshot s WHERE s.source_event_id=source.id
        AND s.organization_id=NEW.organization_id AND s.original_envelope=event.source_identity)
      OR NOT ((event.action='create' AND source.type='community.activity' AND event.activity_id=source.id)
        OR (event.action='void' AND source.type='record.void' AND source.voids_event_id=event.activity_id))
    THEN RAISE EXCEPTION 'Community source link mismatch' USING ERRCODE='23514'; END IF;
    IF event.action='create' AND NOT EXISTS (
      SELECT 1 FROM community_communityactivity a JOIN reviews_reviewsourcesnapshot s ON s.source_event_id=source.id
      WHERE a.id=event.activity_id AND a.zone_id=(source.payload->>'zone_id')::uuid
        AND a.type_id=(source.payload->>'type_id')::uuid AND a.attendance::text=source.payload->>'attendance'
        AND s.facts->'owner'->'community'->>'zone_version_id'=a.zone_version_id::text
        AND s.facts->'owner'->'community'->'type_snapshot'=a.type_snapshot
        AND s.facts->'owner'->'community'->>'activity_date'=a.activity_date::text
        AND s.facts->'owner'->'community'->>'timezone'=a.captured_timezone
        AND s.facts->'owner'->'community'->'command'->>'agreements'=a.agreements
        AND s.facts->'owner'->'community'->'command'->>'other_text'=a.other_text
    ) THEN RAISE EXCEPTION 'Community retained capture mismatch' USING ERRCODE='23514'; END IF;
  WHEN 'community_complaintincidentlink' THEN
    SELECT * INTO activity FROM community_communityactivity WHERE id=NEW.activity_id;
    IF activity.id IS NULL OR activity.organization_id<>NEW.organization_id OR activity.created_by_id<>NEW.created_by_id
      OR NEW.reason<>activity.agreements OR btrim(NEW.reason)=''
      OR NOT EXISTS (SELECT 1 FROM incidents_incident i JOIN geography_block b ON b.id=activity.zone_id
        JOIN geography_quadrant q ON q.id=b.quadrant_id WHERE i.id=NEW.incident_id
          AND i.organization_id=NEW.organization_id AND i.center_id=q.center_id AND i.quadrant_id=q.id)
    THEN RAISE EXCEPTION 'Community complaint link mismatch' USING ERRCODE='23514'; END IF;
  WHEN 'community_communitysourcecancellation' THEN
    SELECT * INTO source FROM field_sync_fieldevent WHERE id=NEW.source_event_id;
    SELECT * INTO target FROM field_sync_fieldevent WHERE id=NEW.target_event_id;
    IF source.id IS NULL OR target.id IS NULL OR source.organization_id<>NEW.organization_id
      OR target.organization_id<>NEW.organization_id OR source.type<>'record.void' OR target.type<>'community.activity'
      OR source.created_by_id<>NEW.created_by_id OR target.created_by_id<>NEW.created_by_id
      OR target.voided_by_id<>NEW.created_by_id OR target.voided_at IS NULL
      OR source.voids_event_id<>target.id OR source.payload_sha256<>NEW.source_payload_hash
      OR target.void_reason<>NEW.reason OR target.void_reason_code<>NEW.reason_code
      OR EXISTS (SELECT 1 FROM community_communityactivity WHERE id=target.id)
    THEN RAISE EXCEPTION 'Community source cancellation mismatch' USING ERRCODE='23514'; END IF;
  ELSE RAISE EXCEPTION 'Unsupported community fact' USING ERRCODE='23514';
  END CASE;
  RETURN NEW;
END $$;

CREATE FUNCTION community_require_source(identifier uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE source field_sync_fieldevent; target field_sync_fieldevent;
BEGIN
  SELECT * INTO source FROM field_sync_fieldevent WHERE id=identifier;
  IF source.id IS NULL OR source.status='rejected' THEN RETURN; END IF;
  IF source.type NOT IN ('community.activity','record.void') THEN RETURN; END IF;
  IF source.status<>'accepted' AND NOT EXISTS (
    SELECT 1 FROM reviews_revieweffectreceipt WHERE source_event_id=source.id
  ) THEN RETURN; END IF;
  IF source.type='community.activity' THEN
    IF NOT EXISTS (SELECT 1 FROM community_communityactivityevent e
      JOIN community_communitysourcelink l ON l.event_id=e.id
      WHERE e.activity_id=source.id AND e.action='create' AND l.source_event_id=source.id)
    THEN RAISE EXCEPTION 'Effective community source lacks operation/link' USING ERRCODE='23514'; END IF;
  ELSIF source.type='record.void' THEN
    SELECT * INTO target FROM field_sync_fieldevent WHERE id=source.voids_event_id AND type='community.activity';
    IF target.id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM community_communitysourcelink l JOIN community_communityactivityevent e ON e.id=l.event_id
      WHERE l.source_event_id=source.id AND e.activity_id=target.id AND e.action='void'
    ) AND NOT EXISTS (SELECT 1 FROM community_communitysourcecancellation WHERE source_event_id=source.id AND target_event_id=target.id)
    THEN RAISE EXCEPTION 'Effective community correction lacks proof' USING ERRCODE='23514'; END IF;
  END IF;
END $$;

CREATE FUNCTION community_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event community_communityactivityevent; identifier uuid; source field_sync_fieldevent;
BEGIN
  IF TG_TABLE_NAME='field_sync_fieldevent' THEN
    PERFORM community_require_source(NEW.id);
    IF NEW.type='community.activity' AND NEW.voided_at IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM community_communityactivityevent WHERE activity_id=NEW.id AND action='void'
    ) AND NOT EXISTS (SELECT 1 FROM community_communitysourcecancellation WHERE target_event_id=NEW.id)
    THEN RAISE EXCEPTION 'Community void stamp lacks owner proof' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME='reviews_revieweffectreceipt' THEN
    PERFORM community_require_source(NEW.source_event_id);
    RETURN NEW;
  ELSIF TG_TABLE_NAME='community_communityactivity' THEN
    IF NOT EXISTS (SELECT 1 FROM community_communityactivityevent WHERE activity_id=NEW.id AND revision=1) THEN
      RAISE EXCEPTION 'Community activity lacks create event' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME='community_communityactivityevent' THEN
    event:=NEW;
  ELSIF TG_TABLE_NAME='community_complaintincidentlink' THEN
    SELECT * INTO event FROM community_communityactivityevent WHERE activity_id=NEW.activity_id AND action='create';
    IF NOT EXISTS (SELECT 1 FROM community_communitycommandreceipt r WHERE r.event_id=event.id
      AND r.command->>'incident_id'=NEW.incident_id::text) THEN
      RAISE EXCEPTION 'Community complaint lacks original command' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME IN ('community_communitycommandreceipt','community_communitysourcelink') THEN
    SELECT * INTO event FROM community_communityactivityevent WHERE id=NEW.event_id;
  ELSIF TG_TABLE_NAME='community_communitysourcecancellation' THEN
    SELECT * INTO source FROM field_sync_fieldevent WHERE id=NEW.source_event_id;
    IF (source.status='accepted' OR EXISTS (
      SELECT 1 FROM reviews_revieweffectreceipt r
      WHERE r.source_event_id=source.id AND r.organization_id=NEW.organization_id
    )) IS NOT TRUE THEN
      RAISE EXCEPTION 'Community cancellation requires an effective correction' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  ELSE RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM community_communitycommandreceipt WHERE event_id=event.id) THEN
    RAISE EXCEPTION 'Community operation lacks immutable receipt' USING ERRCODE='23514';
  END IF;
  IF event.origin='field' THEN
    SELECT * INTO source FROM field_sync_fieldevent WHERE id=event.declared_source_uuid;
    IF source.id IS NULL OR NOT EXISTS (SELECT 1 FROM community_communitysourcelink WHERE event_id=event.id AND source_event_id=source.id)
      OR (source.status<>'accepted' AND NOT EXISTS (SELECT 1 FROM reviews_revieweffectreceipt WHERE source_event_id=source.id))
    THEN RAISE EXCEPTION 'Community source effect incomplete' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
"""

FORWARD = GUARDS + "\n".join(
    f"CREATE TRIGGER {table}_guard BEFORE INSERT OR UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION community_fact_guard();\n"
    f"CREATE CONSTRAINT TRIGGER {table}_complete AFTER INSERT ON {table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION community_complete();"
    for table in TABLES
) + """
CREATE CONSTRAINT TRIGGER community_source_complete AFTER INSERT OR UPDATE ON field_sync_fieldevent
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.type IN ('community.activity','record.void')) EXECUTE FUNCTION community_complete();
CREATE CONSTRAINT TRIGGER community_review_complete AFTER INSERT ON reviews_revieweffectreceipt
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION community_complete();
"""

REVERSE = "DO $$ BEGIN IF " + " OR ".join(f"EXISTS(SELECT 1 FROM {table})" for table in TABLES) + """ THEN
RAISE EXCEPTION 'Cannot reverse retained community facts' USING ERRCODE='55000'; END IF; END $$;
DROP TRIGGER community_review_complete ON reviews_revieweffectreceipt;
DROP TRIGGER community_source_complete ON field_sync_fieldevent;
""" + "\n".join(
    f"DROP TRIGGER {table}_complete ON {table}; DROP TRIGGER {table}_guard ON {table};"
    for table in TABLES
) + "DROP FUNCTION community_complete(); DROP FUNCTION community_require_source(uuid); DROP FUNCTION community_fact_guard();"


class Migration(migrations.Migration):
    dependencies = [("community", "0001_initial"), ("reviews", "0004_transfer_source_dependency")]
    operations = [migrations.RunSQL(FORWARD, REVERSE)]
