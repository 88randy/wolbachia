import type { SqlExecutor } from "./sql.ts";

/** Owner records include all outbox history and durable drafts/projections, even before capture. */
export async function hasLocalRecords(db: SqlExecutor): Promise<boolean> {
  const rows = await db.query(`SELECT 1 FROM outbox_event
    UNION ALL SELECT 1 FROM shift_open_state LIMIT 1`);
  return rows.length > 0;
}
