import {
  AUTHORITY_REVISION,
  CAPTURE_SCOPE_AVAILABLE,
  configurationStatement,
  assignmentPublication,
  StaleAssignmentAuthorityError,
} from "./snapshot-authority.ts";
import type { AssignmentAuthority } from "./snapshot-authority.ts";
import { readPhysicalIdentityState } from "../ovitrap-lifecycle/physical-identity-state.ts";
import { RETIRED_CAPTURE_DRAFT } from "../ovitrap-lifecycle/retired-draft.ts";
import { physicalOvitrap } from "../ovitrap-lifecycle/physical-projection.ts";
import { captureWeek } from "./capture-week.ts";
import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import { readInteger, readText } from "../../db/sql.ts";
import { toOutboxEvent } from "../../outbox/outbox-event.ts";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
import type { Assignment, Catalog, Draft, Rules } from "./types.ts";
export interface Snapshots {
  readonly catalog: Catalog | null;
  readonly rules: Rules | null;
  readonly assignment: Assignment | null;
}
export interface StoredCapture {
  readonly draft: Draft | null;
  readonly event: OutboxEvent | null;
}
/** SQLite is the only source of saved status; local projections retain every captured version. */
export class OvitrapStore {
  readonly #db: SqlExecutor;
  constructor(db: SqlExecutor) {
    this.#db = db;
  }
  async read(): Promise<StoredCapture> {
    const [row] = await this.#db.query("SELECT draft, event_id FROM ovitrap_draft WHERE slot = 1");
    if (!row) return { draft: null, event: null };
    return {
      draft: JSON.parse(readText(row, "draft")) as Draft,
      event: typeof row.event_id === "string" ? await this.event(row.event_id) : null,
    };
  }
  async event(id: string): Promise<OutboxEvent | null> {
    const [row] = await this.#db.query("SELECT * FROM outbox_event WHERE id = ?", [id]);
    return row ? toOutboxEvent(row) : null;
  }
  async snapshots(): Promise<Snapshots> {
    const [row] = await this.#db
      .query(`SELECT json_remove(CASE WHEN ${CAPTURE_SCOPE_AVAILABLE} THEN value
      ELSE json_set(value,'$.assignment',json('null')) END,'$.authorityRevision') AS value FROM kv WHERE key='ovitrap_snapshots'`);
    return row
      ? (JSON.parse(readText(row, "value")) as Snapshots)
      : { catalog: null, rules: null, assignment: null };
  }
  /** Refresh only configuration; stale assignment fields supplied by an old caller are ignored. */
  async saveSnapshots(snapshots: Pick<Snapshots, "catalog" | "rules">): Promise<void> {
    await this.#db.runAtomically([configurationStatement(snapshots)]);
  }
  async assignmentAuthority(): Promise<AssignmentAuthority> {
    const [row] = await this.#db.query(
      `SELECT ${AUTHORITY_REVISION} AS revision FROM kv WHERE key='ovitrap_snapshots'`,
    );
    return { revision: row ? readInteger(row, "revision") : 0 };
  }
  /** A truly authoritative provider must publish using the token captured before its asynchronous work. */
  async publishSnapshots(snapshots: Snapshots, authority: AssignmentAuthority): Promise<void> {
    const statement = assignmentPublication(snapshots, authority);
    const rows = await this.#db.query(statement.sql, statement.params);
    if (rows.length === 0) throw new StaleAssignmentAuthorityError();
  }
  async begin(draft: Draft): Promise<void> {
    await this.#db.runAtomically([
      {
        sql: `INSERT INTO ovitrap_superseded_draft(event_id, replacement_event_id, draft)
          SELECT json_extract(draft, '$.eventId'), ?, draft FROM ovitrap_draft
          WHERE slot = 1 AND event_id IS NULL AND (json_extract(draft, '$.shiftId') <> ? OR ${RETIRED_CAPTURE_DRAFT})`,
        params: [draft.eventId, draft.shiftId],
      },
      {
        sql: `INSERT INTO ovitrap_draft(slot, draft) VALUES (1, ?) ON CONFLICT(slot) DO UPDATE SET draft = excluded.draft, event_id = NULL
          WHERE ovitrap_draft.event_id IS NOT NULL OR json_extract(ovitrap_draft.draft, '$.shiftId') <> json_extract(excluded.draft, '$.shiftId') OR ${RETIRED_CAPTURE_DRAFT}`,
        params: [JSON.stringify(draft)],
      },
    ]);
  }
  async update(draft: Draft): Promise<boolean> {
    const rows = await this.#db.query(
      "UPDATE ovitrap_draft SET draft = ? WHERE slot = 1 AND event_id IS NULL AND json_extract(draft, '$.eventId') = ? RETURNING slot",
      [JSON.stringify(draft), draft.eventId],
    );
    return rows.length === 1;
  }
  async capturedDraft(id: string): Promise<Draft | null> {
    const [row] = await this.#db.query("SELECT draft FROM ovitrap_capture WHERE event_id = ?", [
      id,
    ]);
    return row ? (JSON.parse(readText(row, "draft")) as Draft) : null;
  }
  async projection(id: string): Promise<Draft | null> {
    const [row] = await this.#db.query(
      "SELECT draft FROM ovitrap_capture WHERE ovitrap_id = ? ORDER BY rowid LIMIT 1",
      [id],
    );
    return row ? (JSON.parse(readText(row, "draft")) as Draft) : null;
  }
  async lifecycleSource(id: string, point: Draft["point"] = null) {
    const physical = await physicalOvitrap(this.#db, id);
    const [row] = await this.#db.query(
      "SELECT draft FROM lifecycle_capture WHERE kind='replace' AND json_extract(draft,'$.replacementId')=?",
      [id],
    );
    const lifecycle = row
      ? (JSON.parse(readText(row, "draft")) as { readonly evidence: Draft["evidence"] })
      : null;
    const state =
      physical ?? (await readPhysicalIdentityState(this.#db, { id, pointId: point?.id ?? null }));
    return { physical, evidence: lifecycle?.evidence ?? [], isRetired: state.isRetired };
  }
  async lifecycleTargetId(id: string): Promise<string | null> {
    const visited = new Set<string>();
    let current = id;
    while (!visited.has(current)) {
      visited.add(current);
      const physical = await physicalOvitrap(this.#db, current);
      if (!physical) return null;
      if (!physical.isRetired) return physical.id;
      if (!physical.replacedBy) return null;
      current = physical.replacedBy;
    }
    throw new Error("Invalid physical lineage cycle.");
  }
  async repeat(draft: Draft): Promise<OutboxEvent | null> {
    const week = captureWeek(draft);
    if (!week) return null;
    const [row] = await this.#db.query(
      `SELECT c.event_id FROM ovitrap_capture c WHERE c.ovitrap_id = ? AND c.epi_week = ? AND c.mode = 'check'
      AND NOT EXISTS (SELECT 1 FROM ovitrap_lineage l WHERE l.target_event_id = c.event_id) LIMIT 1`,
      [draft.ovitrapId, week],
    );
    return row ? this.event(readText(row, "event_id")) : null;
  }
  async reuse(draft: Draft) {
    const candidates = draft.assignment?.reuse ?? [];
    const rows = await this.#db.query(
      "SELECT json_extract(draft, '$.reuseId') AS id, COUNT(*) AS uses FROM ovitrap_capture GROUP BY json_extract(draft, '$.reuseId')",
    );
    return candidates.map((item) => ({
      ...item,
      reuses: item.reuses + Number(rows.find((row) => row.id === item.id)?.uses ?? 0),
    }));
  }
  async isBagReserved(code: string): Promise<boolean> {
    const rows = await this.#db.query(
      "SELECT event_id FROM ovitrap_capture WHERE json_extract(draft, '$.bagCode') = ? LIMIT 1",
      [code],
    );
    return rows.length > 0;
  }
  commitStatements(draft: Draft): readonly SqlStatement[] {
    const week = captureWeek(draft);
    if (!week) throw new Error("Capture blocked: weekContext");
    return [
      ...this.#lineage(draft),
      {
        sql: "INSERT INTO ovitrap_capture(event_id, ovitrap_id, mode, epi_week, draft) VALUES (?, ?, ?, ?, ?)",
        params: [draft.eventId, draft.ovitrapId, draft.mode, week, JSON.stringify(draft)],
      },
      ...Array.from(
        new Map(
          [...draft.sourceEvidence, ...draft.evidence].map((item) => [item.id, item]),
        ).values(),
      ).map((evidence) => ({
        sql: "INSERT INTO ovitrap_evidence(event_id, evidence_id, file_ref) VALUES (?, ?, ?)",
        params: [draft.eventId, evidence.id, evidence.fileRef],
      })),
      {
        sql: "UPDATE ovitrap_draft SET draft = ?, event_id = ? WHERE slot = 1",
        params: [JSON.stringify(draft), draft.eventId],
      },
    ];
  }
  #lineage(draft: Draft): readonly SqlStatement[] {
    if (!draft.voidEventId || !draft.replacesEventId) return [];
    return [
      {
        sql: "INSERT INTO ovitrap_lineage(void_event_id, target_event_id, replacement_event_id) VALUES (?, ?, ?)",
        params: [draft.voidEventId, draft.replacesEventId, draft.eventId],
      },
    ];
  }
}
