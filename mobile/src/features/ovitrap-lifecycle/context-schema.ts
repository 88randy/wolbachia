import {
  CAPTURE_CONTEXT_KEY,
  LIFECYCLE_BOOTSTRAP_PENDING,
  capturePointScopeSql,
  CURRENT_CAPTURE_CONTEXT,
  RETAINED_PROJECTION_KINDS,
} from "./context-sql.ts";
import { currentPointScopeSql } from "./current-scope.ts";

/** Additive schema15 only. No historical builder is changed or used as a new ownership proof. */
export const LIFECYCLE_CONTEXT_SCHEMA: readonly string[] = [
  `INSERT INTO kv(key,value) VALUES('${LIFECYCLE_BOOTSTRAP_PENDING}','true')`,
  ...["INSERT", "UPDATE"].map(
    (action) => `CREATE TRIGGER lifecycle_context_${action.toLowerCase()}_cas BEFORE ${action} ON kv
    WHEN NEW.key='${CAPTURE_CONTEXT_KEY}' AND NEW.value IS NULL
    BEGIN SELECT RAISE(ABORT,'stale capture context revision'); END`,
  ),
  "DROP TRIGGER ovitrap_capture_current_scope",
  `CREATE TRIGGER ovitrap_capture_current_scope BEFORE INSERT ON ovitrap_capture
    WHEN NOT EXISTS(${currentPointScopeSql("json_extract(NEW.draft,'$.point.id')")})
      OR NOT EXISTS(${capturePointScopeSql("json_extract(NEW.draft,'$.point.id')")})
    BEGIN SELECT RAISE(ABORT,'current M08 assignment, capture scope or epoch is unavailable'); END`,
  "DROP TRIGGER lifecycle_capture_current_scope",
  "DROP TRIGGER lifecycle_void_current_scope",
  `CREATE TRIGGER lifecycle_capture_current_scope BEFORE INSERT ON lifecycle_capture
    WHEN NOT EXISTS(${capturePointScopeSql("NEW.point_id")}) OR NOT EXISTS(
      SELECT 1 FROM lifecycle_courier_projection origin JOIN (${CURRENT_CAPTURE_CONTEXT}) current
        ON json_extract(origin.body,'$.ownerKey')=json_extract(current.value,'$.ownerKey')
      WHERE origin.kind='lifecycle.owned-draft' AND origin.id=NEW.event_id
        AND json_extract(origin.body,'$.pointId')=NEW.point_id AND json_extract(origin.body,'$.ovitrapId')=NEW.ovitrap_id
        AND json_extract(origin.body,'$.kind')=NEW.kind)
      OR NEW.event_id IS NOT json_extract(NEW.draft,'$.eventId') OR NEW.point_id IS NOT json_extract(NEW.draft,'$.point.id')
      OR NEW.ovitrap_id IS NOT json_extract(NEW.draft,'$.ovitrapId') OR NEW.kind IS NOT json_extract(NEW.draft,'$.kind')
      OR NOT EXISTS(SELECT 1 FROM outbox_event WHERE id=NEW.event_id AND type='ovitrap.'||NEW.kind
        AND json_extract(payload,'$.ovitrap_id')=NEW.ovitrap_id AND local_status='pending')
    BEGIN SELECT RAISE(ABORT,'current capture scope or epoch is unavailable'); END`,
  `CREATE TRIGGER lifecycle_void_current_scope BEFORE INSERT ON lifecycle_void
    WHEN NOT EXISTS(SELECT 1 FROM lifecycle_capture source
      JOIN lifecycle_courier_projection origin ON origin.kind='lifecycle.owned-source' AND origin.id=source.event_id
      JOIN (${CURRENT_CAPTURE_CONTEXT}) current ON json_extract(origin.body,'$.ownerKey')=json_extract(current.value,'$.ownerKey')
      WHERE source.event_id=NEW.target_event_id AND EXISTS(${capturePointScopeSql("source.point_id", false)}))
    BEGIN SELECT RAISE(ABORT,'current capture scope no longer grants this correction'); END`,
  `CREATE TRIGGER lifecycle_capture_owns_source AFTER INSERT ON lifecycle_capture
    WHEN EXISTS(SELECT 1 FROM outbox_event WHERE id=NEW.event_id AND type='ovitrap.'||NEW.kind
      AND json_extract(payload,'$.ovitrap_id')=NEW.ovitrap_id AND local_status='pending')
      AND NEW.event_id=json_extract(NEW.draft,'$.eventId') AND NEW.point_id=json_extract(NEW.draft,'$.point.id')
    BEGIN INSERT INTO lifecycle_courier_projection(kind,id,version,sequence,body)
      SELECT 'lifecycle.owned-source',NEW.event_id,'local-capture-v1',0,
        json_set(origin.body,'$.kind',NEW.kind)
      FROM lifecycle_courier_projection origin WHERE origin.kind='lifecycle.owned-draft' AND origin.id=NEW.event_id; END`,
  ...["UPDATE", "DELETE"].map(
    (
      action,
    ) => `CREATE TRIGGER lifecycle_owned_fact_${action.toLowerCase()} BEFORE ${action} ON lifecycle_courier_projection
    WHEN OLD.kind IN (${RETAINED_PROJECTION_KINDS}) ${action === "UPDATE" ? `OR NEW.kind IN (${RETAINED_PROJECTION_KINDS})` : ""}
    BEGIN SELECT RAISE(ABORT,'authenticated lifecycle source history is immutable'); END`,
  ),
  `CREATE TRIGGER lifecycle_reviewed_dependency BEFORE INSERT ON lifecycle_void WHEN EXISTS(
    SELECT 1 FROM lifecycle_courier_projection WHERE kind='lifecycle.reviewed-proposal' AND id=NEW.target_event_id)
    BEGIN SELECT RAISE(ABORT,'reviewed lifecycle dependents prevent correction'); END`,
];
