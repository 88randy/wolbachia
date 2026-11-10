import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import { readText } from "../../db/sql.ts";
import type { EvidenceFence } from "../../attachments/types.ts";
import { CURRENT_FENCE, fenceParams } from "../../attachments/attachment-store.ts";
import { toOutboxEvent } from "../../outbox/outbox-event.ts";
import type { SampleDraft } from "./types.ts";

export function requireSampleGuard(guard: SqlStatement): SqlStatement {
  return {
    sql: `INSERT INTO lifecycle_guard(slot,value) VALUES(1,CASE WHEN EXISTS(${guard.sql}) THEN 1 ELSE 0 END)
      ON CONFLICT(slot) DO UPDATE SET value=excluded.value`,
    params: guard.params ?? [],
  };
}
/** Raw JSON CAS, immutable event UUID and evidence enrollment share the existing outbox transaction. */
export class SampleStore {
  readonly db: SqlExecutor;
  constructor(db: SqlExecutor) {
    this.db = db;
  }
  async list(owner: string): Promise<readonly SampleDraft[]> {
    const rows = await this.db.query(
      "SELECT draft FROM sample_draft WHERE owner_key=? ORDER BY rowid DESC",
      [owner],
    );
    return rows.map((row) => JSON.parse(readText(row, "draft")) as SampleDraft);
  }
  async read(sampleId: string, owner: string) {
    const [row] = await this.db.query(
      "SELECT draft,event_id FROM sample_draft WHERE sample_id=? AND owner_key=?",
      [sampleId, owner],
    );
    if (!row) return null;
    const [event] =
      typeof row.event_id === "string"
        ? await this.db.query("SELECT * FROM outbox_event WHERE id=?", [row.event_id])
        : [];
    return {
      draft: JSON.parse(readText(row, "draft")) as SampleDraft,
      raw: readText(row, "draft"),
      event: event ? toOutboxEvent(event) : null,
    };
  }
  begin(draft: SampleDraft, guards: readonly SqlStatement[]): Promise<void> {
    return this.db.runAtomically([
      ...guards.map(requireSampleGuard),
      {
        sql: "INSERT INTO sample_draft(id,sample_id,owner_key,draft) VALUES(?,?,?,?)",
        params: [draft.eventId, draft.sampleId, draft.ownerKey, JSON.stringify(draft)],
      },
    ]);
  }
  draftGuard(input: { id: string; raw: string; fence: EvidenceFence }): SqlStatement {
    return {
      sql: `SELECT 1 FROM sample_draft WHERE sample_id=? AND draft=? AND event_id IS NULL AND owner_key=? AND ${CURRENT_FENCE}`,
      params: [input.id, input.raw, input.fence.ownerKey, ...fenceParams(input.fence)],
    };
  }
  update(draft: SampleDraft, guards: readonly SqlStatement[]): Promise<void> {
    return this.db.runAtomically([
      ...guards.map(requireSampleGuard),
      {
        sql: "UPDATE sample_draft SET draft=? WHERE id=? AND event_id IS NULL",
        params: [JSON.stringify(draft), draft.eventId],
      },
    ]);
  }
  saveStatements(draft: SampleDraft, guards: readonly SqlStatement[]): readonly SqlStatement[] {
    return [
      ...guards.map(requireSampleGuard),
      {
        sql: "UPDATE sample_draft SET draft=?,event_id=? WHERE id=? AND event_id IS NULL",
        params: [JSON.stringify(draft), draft.eventId, draft.eventId],
      },
    ];
  }
  async evidencePending(draft: SampleDraft): Promise<boolean> {
    const rows = await this.db.query(
      `SELECT 1 FROM json_each(?) declared LEFT JOIN attachment_file file ON file.id=declared.value
      WHERE file.id IS NULL OR file.owner_key<>? OR file.draft_id<>? OR file.state<>'verified' OR file.verified_at IS NULL LIMIT 1`,
      [JSON.stringify(draft.evidence.map(({ id }) => id)), draft.ownerKey, draft.eventId],
    );
    return rows.length > 0;
  }
}
