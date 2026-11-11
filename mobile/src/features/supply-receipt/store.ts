import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import { readText } from "../../db/sql.ts";
import { signatureModeFromRules } from "./signature-need.ts";
import type { SignatureMode } from "./signature-need.ts";
import type { EvidenceFence } from "../../attachments/types.ts";
import { CURRENT_FENCE, fenceParams } from "../../attachments/attachment-store.ts";
import { toOutboxEvent } from "../../outbox/outbox-event.ts";
import type { ReceiptDraft } from "./receipt-types.ts";

/** A failed predicate aborts the complete event/draft/reference transaction. */
export function requireGuard(guard: SqlStatement): SqlStatement {
  return {
    sql: `INSERT INTO lifecycle_guard(slot,value) VALUES(1,CASE WHEN EXISTS(${guard.sql}) THEN 1 ELSE 0 END)
    ON CONFLICT(slot) DO UPDATE SET value=excluded.value`,
    params: guard.params ?? [],
  };
}
export class ReceiptStore {
  readonly db: SqlExecutor;
  constructor(db: SqlExecutor) {
    this.db = db;
  }
  async hasRelease(owner: string, releaseId: string): Promise<boolean> {
    const rows = await this.db.query(
      "SELECT 1 FROM supply_receipt_draft WHERE owner_key=? AND json_extract(draft,'$.releaseId')=?",
      [owner, releaseId],
    );
    return rows.length > 0;
  }
  async list(owner: string): Promise<readonly ReceiptDraft[]> {
    const rows = await this.db.query(
      "SELECT draft FROM supply_receipt_draft WHERE owner_key=? ORDER BY rowid DESC",
      [owner],
    );
    return rows.map((row) => JSON.parse(readText(row, "draft")) as ReceiptDraft);
  }
  async read(id: string, owner: string) {
    const [row] = await this.db.query(
      "SELECT draft,event_id FROM supply_receipt_draft WHERE id=? AND owner_key=?",
      [id, owner],
    );
    if (!row) return null;
    const [event] =
      typeof row.event_id === "string"
        ? await this.db.query("SELECT * FROM outbox_event WHERE id=?", [row.event_id])
        : [];
    return {
      draft: JSON.parse(readText(row, "draft")) as ReceiptDraft,
      raw: readText(row, "draft"),
      event: event ? toOutboxEvent(event) : null,
    };
  }
  async begin(draft: ReceiptDraft, guards: readonly SqlStatement[]): Promise<void> {
    await this.db.runAtomically([
      ...guards.map(requireGuard),
      {
        sql: "INSERT INTO supply_receipt_draft(id,owner_key,draft) VALUES(?,?,?)",
        params: [draft.eventId, draft.ownerKey, JSON.stringify(draft)],
      },
    ]);
  }
  draftGuard(input: { id: string; raw: string; fence: EvidenceFence }): SqlStatement {
    return {
      sql: `SELECT 1 FROM supply_receipt_draft WHERE id=? AND draft=? AND event_id IS NULL AND owner_key=? AND ${CURRENT_FENCE}`,
      params: [input.id, input.raw, input.fence.ownerKey, ...fenceParams(input.fence)],
    };
  }
  async update(draft: ReceiptDraft, guards: readonly SqlStatement[]): Promise<void> {
    await this.db.runAtomically([
      ...guards.map(requireGuard),
      {
        sql: "UPDATE supply_receipt_draft SET draft=? WHERE id=? AND event_id IS NULL",
        params: [JSON.stringify(draft), draft.eventId],
      },
    ]);
  }
  saveStatements(draft: ReceiptDraft, guards: readonly SqlStatement[]): readonly SqlStatement[] {
    return [
      ...guards.map(requireGuard),
      {
        sql: "UPDATE supply_receipt_draft SET event_id=? WHERE id=? AND event_id IS NULL",
        params: [draft.eventId, draft.eventId],
      },
    ];
  }
  async signaturePending(id: string | null): Promise<boolean> {
    if (id === null) return false;
    const rows = await this.db.query(
      "SELECT 1 FROM attachment_file WHERE id=? AND state='verified' AND verified_at IS NOT NULL",
      [id],
    );
    return !rows.length;
  }
  async versions(): Promise<{ catalog: string; rules: string; signatureMode: SignatureMode }> {
    const rows = await this.db.query(
      "SELECT key,value FROM kv WHERE key IN ('shift_open_catalog','shift_open_rules')",
    );
    const read = (key: string) => {
      const row = rows.find((entry) => entry.key === key);
      return row ? (JSON.parse(readText(row, "value")) as { version: string }).version : "";
    };
    const rules = rows.find((entry) => entry.key === "shift_open_rules");
    const parameters = rules
      ? (JSON.parse(readText(rules, "value")) as { parameters?: unknown }).parameters
      : undefined;
    return {
      catalog: read("shift_open_catalog"),
      rules: read("shift_open_rules"),
      signatureMode: signatureModeFromRules(parameters),
    };
  }
}
