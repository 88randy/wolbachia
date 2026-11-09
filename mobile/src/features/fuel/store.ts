import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import { readText } from "../../db/sql.ts";
import type { EvidenceFence } from "../../attachments/types.ts";
import { CURRENT_FENCE, fenceParams } from "../../attachments/attachment-store.ts";
import { toOutboxEvent } from "../../outbox/outbox-event.ts";
import type { FuelDraft } from "./types.ts";
import { FuelError } from "./domain.ts";

/** A failed predicate aborts the entire draft/event/file enrollment transaction. */
export function requireFuelGuard(guard: SqlStatement): SqlStatement {
  return {
    sql: `INSERT INTO lifecycle_guard(slot,value) VALUES(1,CASE WHEN EXISTS(${guard.sql}) THEN 1 ELSE 0 END)
      ON CONFLICT(slot) DO UPDATE SET value=excluded.value`,
    params: guard.params ?? [],
  };
}
export class FuelStore {
  readonly db: SqlExecutor;
  constructor(db: SqlExecutor) {
    this.db = db;
  }
  async list(owner: string): Promise<readonly FuelDraft[]> {
    const rows = await this.db.query(
      "SELECT draft FROM fuel_draft WHERE owner_key=? ORDER BY rowid DESC",
      [owner],
    );
    return rows.map((row) => JSON.parse(readText(row, "draft")) as FuelDraft);
  }
  async read(id: string, owner: string) {
    const [row] = await this.db.query(
      "SELECT draft,event_id FROM fuel_draft WHERE id=? AND owner_key=?",
      [id, owner],
    );
    if (!row) return null;
    const [event] =
      typeof row.event_id === "string"
        ? await this.db.query("SELECT * FROM outbox_event WHERE id=?", [row.event_id])
        : [];
    return {
      draft: JSON.parse(readText(row, "draft")) as FuelDraft,
      raw: readText(row, "draft"),
      event: event ? toOutboxEvent(event) : null,
    };
  }
  begin(draft: FuelDraft, guards: readonly SqlStatement[]): Promise<void> {
    return this.db.runAtomically([
      ...guards.map(requireFuelGuard),
      {
        sql: "INSERT INTO fuel_draft(id,owner_key,draft) VALUES(?,?,?)",
        params: [draft.eventId, draft.ownerKey, JSON.stringify(draft)],
      },
    ]);
  }
  draftGuard(input: { id: string; raw: string; fence: EvidenceFence }): SqlStatement {
    return {
      sql: `SELECT 1 FROM fuel_draft WHERE id=? AND draft=? AND event_id IS NULL AND owner_key=? AND ${CURRENT_FENCE}`,
      params: [input.id, input.raw, input.fence.ownerKey, ...fenceParams(input.fence)],
    };
  }
  update(draft: FuelDraft, guards: readonly SqlStatement[]): Promise<void> {
    return this.db.runAtomically([
      ...guards.map(requireFuelGuard),
      {
        sql: "UPDATE fuel_draft SET draft=? WHERE id=? AND event_id IS NULL",
        params: [JSON.stringify(draft), draft.eventId],
      },
    ]);
  }
  saveStatements(draft: FuelDraft, guards: readonly SqlStatement[]): readonly SqlStatement[] {
    return [
      ...guards.map(requireFuelGuard),
      {
        sql: "UPDATE fuel_draft SET event_id=? WHERE id=? AND event_id IS NULL",
        params: [draft.eventId, draft.eventId],
      },
    ];
  }
  async receiptPending(id: string | null): Promise<boolean> {
    if (id === null) return true;
    const rows = await this.db.query(
      "SELECT 1 FROM attachment_file WHERE id=? AND state='verified' AND verified_at IS NOT NULL",
      [id],
    );
    return rows.length === 0;
  }
  async versions(): Promise<{ catalog: string; rules: string }> {
    const rows = await this.db.query(
      "SELECT key,value FROM kv WHERE key IN ('shift_open_catalog','shift_open_rules')",
    );
    const version = (key: string) => {
      const row = rows.find((entry) => entry.key === key);
      return row ? (JSON.parse(readText(row, "value")) as { version: string }).version : "";
    };
    const result = { catalog: version("shift_open_catalog"), rules: version("shift_open_rules") };
    if (!result.catalog || !result.rules) throw new FuelError("context_unavailable");
    return result;
  }
}
