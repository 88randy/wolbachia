import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import { readText } from "../../db/sql.ts";
import type { EvidenceFence } from "../../attachments/types.ts";
import { CURRENT_FENCE, fenceParams } from "../../attachments/attachment-store.ts";
import { toOutboxEvent } from "../../outbox/outbox-event.ts";
import type { IncidentDraft, IncidentCache } from "./types.ts";
import { IncidentError } from "./domain.ts";
import { setStatement } from "../../db/kv-store.ts";

/** A failed predicate aborts draft, event and evidence enrollment together. */
export function requireIncidentGuard(guard: SqlStatement): SqlStatement {
  return {
    sql: `INSERT INTO lifecycle_guard(slot,value) VALUES(1,CASE WHEN EXISTS(${guard.sql}) THEN 1 ELSE 0 END)
      ON CONFLICT(slot) DO UPDATE SET value=excluded.value`,
    params: guard.params ?? [],
  };
}
export class IncidentStore {
  readonly db: SqlExecutor;
  constructor(db: SqlExecutor) {
    this.db = db;
  }
  async list(owner: string): Promise<readonly IncidentDraft[]> {
    const rows = await this.db.query(
      "SELECT draft FROM incident_draft WHERE owner_key=? ORDER BY rowid DESC",
      [owner],
    );
    return rows.map((row) => JSON.parse(readText(row, "draft")) as IncidentDraft);
  }
  async read(id: string, owner: string) {
    const [row] = await this.db.query(
      "SELECT draft,event_id FROM incident_draft WHERE id=? AND owner_key=?",
      [id, owner],
    );
    if (!row) return null;
    const [event] =
      typeof row.event_id === "string"
        ? await this.db.query("SELECT * FROM outbox_event WHERE id=?", [row.event_id])
        : [];
    return {
      draft: JSON.parse(readText(row, "draft")) as IncidentDraft,
      raw: readText(row, "draft"),
      event: event ? toOutboxEvent(event) : null,
    };
  }
  begin(draft: IncidentDraft, guards: readonly SqlStatement[]): Promise<void> {
    return this.db.runAtomically([
      ...guards.map(requireIncidentGuard),
      {
        sql: "INSERT INTO incident_draft(id,owner_key,draft) VALUES(?,?,?)",
        params: [draft.eventId, draft.ownerKey, JSON.stringify(draft)],
      },
    ]);
  }
  draftGuard(input: { id: string; raw: string; fence: EvidenceFence }): SqlStatement {
    return {
      sql: `SELECT 1 FROM incident_draft WHERE id=? AND draft=? AND event_id IS NULL AND owner_key=? AND ${CURRENT_FENCE}`,
      params: [input.id, input.raw, input.fence.ownerKey, ...fenceParams(input.fence)],
    };
  }
  update(draft: IncidentDraft, guards: readonly SqlStatement[]): Promise<void> {
    return this.db.runAtomically([
      ...guards.map(requireIncidentGuard),
      {
        sql: "UPDATE incident_draft SET draft=? WHERE id=? AND event_id IS NULL",
        params: [JSON.stringify(draft), draft.eventId],
      },
    ]);
  }
  saveStatements(draft: IncidentDraft, guards: readonly SqlStatement[]): readonly SqlStatement[] {
    return [
      ...guards.map(requireIncidentGuard),
      {
        sql: "UPDATE incident_draft SET event_id=? WHERE id=? AND event_id IS NULL",
        params: [draft.eventId, draft.eventId],
      },
    ];
  }
  async evidencePending(draft: IncidentDraft | null): Promise<boolean> {
    if (!draft) return false;
    if (draft.evidence.length < (draft.type?.report_evidence_min ?? 0)) return true;
    for (const photo of draft.evidence) {
      const rows = await this.db.query(
        "SELECT 1 FROM attachment_file WHERE id=? AND state='verified' AND verified_at IS NOT NULL",
        [photo.id],
      );
      if (!rows.length) return true;
    }
    return false;
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
    if (!result.catalog || !result.rules) throw new IncidentError("scope");
    return result;
  }
  async cache(owner: string, signature: string): Promise<IncidentCache | null> {
    const [row] = await this.db.query("SELECT value FROM kv WHERE key=?", [`incidents:${owner}`]);
    if (!row) return null;
    const cache = JSON.parse(readText(row, "value")) as IncidentCache;
    return cache.signature === signature ? cache : null;
  }
  saveCache(owner: string, cache: IncidentCache, guard: SqlStatement): Promise<void> {
    return this.db.runAtomically([
      requireIncidentGuard(guard),
      setStatement(`incidents:${owner}`, JSON.stringify(cache)),
    ]);
  }
}
