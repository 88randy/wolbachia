import type { SqlExecutor, SqlStatement, SqlRow } from "../../db/sql.ts";
import { readText } from "../../db/sql.ts";
import type { EvidenceFence } from "../../attachments/types.ts";
import { CURRENT_FENCE, fenceParams } from "../../attachments/attachment-store.ts";
import { toOutboxEvent } from "../../outbox/outbox-event.ts";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
import { ReleaseError } from "./types.ts";
import type { ReleaseDraft } from "./types.ts";
import { isRecord } from "../day/assignment-parser.ts";

const RESERVATIONS = `WITH captures AS (
  SELECT draft.draft AS release_draft,event.* FROM release_draft draft
    JOIN outbox_event event ON event.id=draft.event_id
    WHERE draft.owner_key=? AND json_extract(draft.draft,'$.pins.device.source_lot_id')=?
), snapshot AS (
  SELECT json_group_array(json_object('id',id,'draft',release_draft,'status',local_status)) AS raw
  FROM (SELECT id,release_draft,local_status FROM captures ORDER BY id)
) SELECT snapshot.raw AS reservation_snapshot,captures.* FROM snapshot
  LEFT JOIN captures ON 1=1 ORDER BY captures.seq`;

export interface ReleaseReservation {
  readonly draft: ReleaseDraft;
  readonly event: OutboxEvent;
}
export interface ReleaseReservations {
  readonly entries: readonly ReleaseReservation[];
  readonly guard: SqlStatement;
}

/** A failed predicate aborts the entire draft/event/file-enrollment transaction. */
export function requireReleaseGuard(guard: SqlStatement): SqlStatement {
  return {
    sql: `INSERT INTO lifecycle_guard(slot,value) VALUES(1,CASE WHEN EXISTS(${guard.sql}) THEN 1 ELSE 0 END)
      ON CONFLICT(slot) DO UPDATE SET value=excluded.value`,
    params: guard.params ?? [],
  };
}
function reservation(row: SqlRow): ReleaseReservation | null {
  return typeof row.release_draft === "string"
    ? { draft: JSON.parse(row.release_draft) as ReleaseDraft, event: toOutboxEvent(row) }
    : null;
}
function snapshotVersion(rows: readonly SqlRow[], key: string): string {
  const row = rows.find((entry) => entry.key === key);
  if (!row) return "";
  const snapshot: unknown = JSON.parse(readText(row, "value"));
  return isRecord(snapshot) && typeof snapshot.version === "string" ? snapshot.version : "";
}

/** Authored releases share the existing outbox and immutable private-evidence journal. */
export class ReleaseStore {
  readonly db: SqlExecutor;
  constructor(db: SqlExecutor) {
    this.db = db;
  }

  async list(owner: string): Promise<readonly ReleaseDraft[]> {
    const rows = await this.db.query(
      "SELECT draft FROM release_draft WHERE owner_key=? ORDER BY rowid DESC",
      [owner],
    );
    return rows.map((row) => JSON.parse(readText(row, "draft")) as ReleaseDraft);
  }
  async read(id: string, owner: string) {
    const [row] = await this.db.query(
      "SELECT draft,event_id FROM release_draft WHERE id=? AND owner_key=?",
      [id, owner],
    );
    if (!row) return null;
    const [event] =
      typeof row.event_id === "string"
        ? await this.db.query("SELECT * FROM outbox_event WHERE id=?", [row.event_id])
        : [];
    return {
      draft: JSON.parse(readText(row, "draft")) as ReleaseDraft,
      raw: readText(row, "draft"),
      event: event ? toOutboxEvent(event) : null,
    };
  }
  begin(draft: ReleaseDraft, guards: readonly SqlStatement[]): Promise<void> {
    return this.db.runAtomically([
      ...guards.map(requireReleaseGuard),
      {
        sql: "INSERT INTO release_draft(id,owner_key,draft) VALUES(?,?,?)",
        params: [draft.eventId, draft.ownerKey, JSON.stringify(draft)],
      },
    ]);
  }
  draftGuard(input: { id: string; raw: string; fence: EvidenceFence }): SqlStatement {
    return {
      sql: `SELECT 1 FROM release_draft WHERE id=? AND draft=? AND event_id IS NULL AND owner_key=? AND ${CURRENT_FENCE}`,
      params: [input.id, input.raw, input.fence.ownerKey, ...fenceParams(input.fence)],
    };
  }
  update(draft: ReleaseDraft, guards: readonly SqlStatement[]): Promise<void> {
    return this.db.runAtomically([
      ...guards.map(requireReleaseGuard),
      {
        sql: "UPDATE release_draft SET draft=? WHERE id=? AND event_id IS NULL",
        params: [JSON.stringify(draft), draft.eventId],
      },
    ]);
  }
  saveStatements(draft: ReleaseDraft, guards: readonly SqlStatement[]): readonly SqlStatement[] {
    return [
      ...guards.map(requireReleaseGuard),
      {
        sql: "UPDATE release_draft SET draft=?,event_id=? WHERE id=? AND event_id IS NULL",
        params: [JSON.stringify(draft), draft.eventId, draft.eventId],
      },
    ];
  }
  async taskCaptured(owner: string, taskId: string): Promise<boolean> {
    const rows = await this.db.query(
      "SELECT 1 FROM release_draft WHERE owner_key=? AND event_id IS NOT NULL AND json_extract(draft,'$.pins.task.id')=? LIMIT 1",
      [owner, taskId],
    );
    return rows.length > 0;
  }
  /** The entries and their raw CAS are one read; another local Save or receipt invalidates it. */
  async reservations(owner: string, lotId: string): Promise<ReleaseReservations> {
    const params = [owner, lotId],
      rows = await this.db.query(RESERVATIONS, params);
    const snapshot = rows[0] ? readText(rows[0], "reservation_snapshot") : "[]";
    return {
      entries: rows.map(reservation).filter((entry): entry is ReleaseReservation => entry !== null),
      guard: {
        sql: `SELECT 1 FROM (${RESERVATIONS}) WHERE reservation_snapshot=? LIMIT 1`,
        params: [...params, snapshot],
      },
    };
  }
  async evidencePending(draft: ReleaseDraft): Promise<boolean> {
    const rows = await this.db.query(
      `SELECT 1 FROM json_each(?) declared LEFT JOIN attachment_file file ON file.id=declared.value
      WHERE file.id IS NULL OR file.owner_key<>? OR file.draft_id<>? OR file.state<>'verified' OR file.verified_at IS NULL LIMIT 1`,
      [JSON.stringify(draft.evidence.map(({ id }) => id)), draft.ownerKey, draft.eventId],
    );
    return rows.length > 0;
  }
  async versions(): Promise<{ catalog: string; rules: string }> {
    const rows = await this.db.query(
      "SELECT key,value FROM kv WHERE key IN ('shift_open_catalog','shift_open_rules')",
    );
    const result = {
      catalog: snapshotVersion(rows, "shift_open_catalog"),
      rules: snapshotVersion(rows, "shift_open_rules"),
    };
    if (!result.catalog || !result.rules) throw new ReleaseError("context_unavailable");
    return result;
  }
}
