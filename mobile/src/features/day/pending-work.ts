const PENDING_STATUSES = "'pending','sending','error','in_review'";
/** [ASSUMPTION] task_id is authoritative; fallback ovitrap retention ignores date/timezone. */
function pendingMatch(payload: string): string {
  return `e.local_status IN (${PENDING_STATUSES}) AND
    (json_extract(e.payload,'$.task_id') = day_assignment.id OR
     (json_extract(e.payload,'$.task_id') IS NULL AND
      json_extract(e.payload,'$.ovitrap_id') = json_extract(${payload},'$.ovitrap_id')))`;
}
export const CURRENT_EVENT_IDS = `(SELECT json_group_array(e.id) FROM outbox_event e
  WHERE ${pendingMatch("day_assignment.payload")})`;
export const PENDING_CURRENT = `(day_assignment.payload IS NOT NULL AND EXISTS
  (SELECT 1 FROM outbox_event e WHERE ${pendingMatch("day_assignment.payload")}))`;
/** Only evidence enrolled while this retained view was visible can justify that view. */
export const PENDING_RETAINED = `(day_assignment.retained_payload IS NOT NULL AND EXISTS
  (SELECT 1 FROM outbox_event e WHERE e.local_status IN (${PENDING_STATUSES})
   AND e.id IN (SELECT value FROM json_each(day_assignment.retained_event_ids))))`;
export const PENDING_WORK = `(${PENDING_CURRENT} OR ${PENDING_RETAINED})`;
export const VISIBLE_ASSIGNMENTS = `SELECT CASE WHEN kept=1 AND ${PENDING_RETAINED} THEN retained_payload ELSE payload END AS payload,
  CASE WHEN kept=1 AND ((${PENDING_RETAINED}) OR (removed=1 AND ${PENDING_CURRENT})) THEN 1 ELSE 0 END AS kept FROM day_assignment
  WHERE payload IS NOT NULL AND (removed=0 OR (kept=1 AND ${PENDING_WORK}))`;
