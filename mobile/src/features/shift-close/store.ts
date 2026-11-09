import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import { readText } from "../../db/sql.ts";
import { toOutboxEvent } from "../../outbox/outbox-event.ts";
import type { CloseDraft } from "./domain.ts";
import type { Schemas } from "@wolbachia/api-client";

export const CLOSE_KIND = "local.shift-close";
/** Authored drafts live in the existing retained projection store, never in downloaded cache. */
export class ShiftCloseStore {
  readonly db: SqlExecutor;
  constructor(db: SqlExecutor) {
    this.db = db;
  }
  async opening() {
    const [row] = await this.db.query(
      "SELECT * FROM outbox_event WHERE type='shift.open' AND local_status<>'rejected' ORDER BY seq DESC LIMIT 1",
    );
    return row ? toOutboxEvent(row) : null;
  }
  async read(shiftId: string): Promise<CloseDraft | null> {
    const [row] = await this.db.query(
      "SELECT body FROM lifecycle_courier_projection WHERE kind=? AND id=?",
      [CLOSE_KIND, shiftId],
    );
    return row ? (JSON.parse(readText(row, "body")) as CloseDraft) : null;
  }
  async create(draft: CloseDraft): Promise<void> {
    await this.db.runAtomically([
      {
        sql: "INSERT OR IGNORE INTO lifecycle_courier_projection(kind,id,version,sequence,body) VALUES(?,?,'1',0,?)",
        params: [CLOSE_KIND, draft.shiftId, JSON.stringify(draft)],
      },
    ]);
  }
  /** NULL id fails NOT NULL and rolls back the entire closing transaction on stale JSON. */
  replace(original: CloseDraft, next: CloseDraft, guard?: SqlStatement): SqlStatement {
    return {
      sql: `INSERT INTO lifecycle_courier_projection(kind,id,version,sequence,body)
        VALUES(?,(SELECT id FROM lifecycle_courier_projection WHERE kind=? AND id=? AND body=? AND EXISTS(${guard?.sql ?? "SELECT 1"})),'1',0,?)
        ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body`,
      params: [
        CLOSE_KIND,
        CLOSE_KIND,
        original.shiftId,
        JSON.stringify(original),
        ...(guard?.params ?? []),
        JSON.stringify(next),
      ],
    };
  }
  async events(shiftId: string) {
    const rows = await this.db.query(
      "SELECT * FROM outbox_event WHERE shift_id=? AND type IN ('supplies.reconcile','shift.close') ORDER BY seq",
      [shiftId],
    );
    return rows.map(toOutboxEvent);
  }
  sourceGuard(ids: readonly string[]): SqlStatement {
    return {
      sql: `SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM kv WHERE key='day_cleanup_pending' AND value='true')
        AND NOT EXISTS(SELECT 1 FROM json_each(?) required WHERE NOT EXISTS(
          SELECT 1 FROM lifecycle_courier_projection source WHERE source.kind='supply_assignment' AND source.id=required.value))`,
      params: [JSON.stringify(ids)],
    };
  }
  async supplies(shiftId: string, date: string | null) {
    const rows = await this.db.query(
      "SELECT body FROM lifecycle_courier_projection WHERE kind='supply_assignment' AND (json_extract(body,'$.shiftId')=? OR (json_extract(body,'$.shiftId') IS NULL AND json_extract(body,'$.date')=?))",
      [shiftId, date],
    );
    return rows.map(
      (row) => JSON.parse(readText(row, "body")) as import("./supplies.ts").SupplySource,
    );
  }
  async history(shiftId: string) {
    const rows = await this.db.query(
      `SELECT body FROM lifecycle_courier_projection WHERE kind='history.shift_validation'
      AND json_extract(body,'$.shift_id')=? ORDER BY CAST(json_extract(body,'$.revision') AS INTEGER)`,
      [shiftId],
    );
    return rows.map((row) => JSON.parse(readText(row, "body")) as Schemas["ReviewHistoryEntry"]);
  }
}
