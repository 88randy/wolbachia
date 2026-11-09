import type { SqlExecutor } from "./sql.ts";

/** Owner records include both retained capture families and the private file journal. */
export async function hasLocalRecords(db: SqlExecutor): Promise<boolean> {
  const rows = await db.query(`SELECT 1 FROM outbox_event
    UNION ALL SELECT 1 FROM shift_open_state
    UNION ALL SELECT 1 FROM lifecycle_courier_projection WHERE kind NOT IN (
      'ovitrap','sampling_point','quadrant','block','history.review_decision',
      'history.shift_validation','history.relocation_proposal','history.transfer_custody')
    UNION ALL SELECT 1 FROM lifecycle_draft
    UNION ALL SELECT 1 FROM ovitrap_draft
    UNION ALL SELECT 1 FROM supply_receipt_draft
    UNION ALL SELECT 1 FROM attachment_file LIMIT 1`);
  return rows.length > 0;
}
