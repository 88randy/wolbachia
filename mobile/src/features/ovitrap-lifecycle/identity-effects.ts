import type { SqlStatement } from "../../db/sql.ts";
/** Local effects are ordered by the existing outbox sequence, including reasoned corrections. */
export const IDENTITY_EFFECTS = `SELECT c.event_id,c.ovitrap_id,1 AS is_retired FROM lifecycle_capture c WHERE c.kind IN ('replace','remove')
  UNION ALL SELECT c.event_id,json_extract(c.draft,'$.replacementId'),0 FROM lifecycle_capture c WHERE c.kind='replace'
  UNION ALL SELECT v.event_id,c.ovitrap_id,0 FROM lifecycle_void v JOIN lifecycle_capture c ON c.event_id=v.target_event_id WHERE c.kind IN ('replace','remove')
  UNION ALL SELECT v.event_id,json_extract(c.draft,'$.replacementId'),1 FROM lifecycle_void v JOIN lifecycle_capture c ON c.event_id=v.target_event_id WHERE c.kind='replace'`;
/** Called INSIDE receipt settlement; a projection delivered on that same page is only the floor. */
export const RECEIPT_EFFECTS = `INSERT OR IGNORE INTO lifecycle_receipt(event_id,ovitrap_id,projection_sequence)
  SELECT effect.event_id,effect.ovitrap_id,COALESCE((SELECT p.sequence FROM lifecycle_courier_projection p
    WHERE p.kind='ovitrap' AND p.id=effect.ovitrap_id),0) FROM lifecycle_identity_effect effect`;
/** A drained delta must be newer than receipt provenance. Serialized bootstrap is authoritative as a whole. */
export function reconcileIdentityEffects(isBootstrap: boolean): SqlStatement {
  return {
    sql: `UPDATE lifecycle_receipt SET is_reconciled=1 WHERE is_reconciled=0
    AND EXISTS(SELECT 1 FROM outbox_event e WHERE e.id=lifecycle_receipt.event_id AND e.local_status='sent')
    AND EXISTS(SELECT 1 FROM lifecycle_courier_projection p WHERE p.kind='ovitrap' AND p.id=lifecycle_receipt.ovitrap_id
      ${isBootstrap ? "" : "AND p.sequence>lifecycle_receipt.projection_sequence"})`,
  };
}
