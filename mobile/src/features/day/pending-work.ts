/** [ASSUMPTION] #9 task_id is authoritative. Without it, retaining unsent evidence conservatively matches the ovitrap,
 * independent of date/time zone. Completion progress is stricter; it cannot inherit historical visits. */
function pendingFor(payload: string): string {
  return `(${payload} IS NOT NULL AND EXISTS (SELECT 1 FROM outbox_event e
    WHERE e.local_status IN ('pending','sending','error','in_review') AND
    (json_extract(e.payload,'$.task_id') = day_assignment.id OR
     (json_extract(e.payload,'$.task_id') IS NULL AND
      json_extract(e.payload,'$.ovitrap_id') = json_extract(${payload},'$.ovitrap_id')))))`;
}
export const PENDING_CURRENT = pendingFor("day_assignment.payload");
export const PENDING_RETAINED = pendingFor("day_assignment.retained_payload");
export const PENDING_WORK = `(${PENDING_CURRENT} OR ${PENDING_RETAINED})`;
export const VISIBLE_ASSIGNMENTS = `SELECT CASE WHEN kept=1 AND ${PENDING_RETAINED} THEN retained_payload ELSE payload END AS payload,
  CASE WHEN kept=1 AND ${PENDING_WORK} THEN 1 ELSE 0 END AS kept FROM day_assignment
  WHERE payload IS NOT NULL AND (removed=0 OR (kept=1 AND ${PENDING_WORK}))`;
