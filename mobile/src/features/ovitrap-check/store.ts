import { captureWeek } from "./capture-week.ts";
import { KvStore } from "../../db/kv-store.ts";
import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import { readText } from "../../db/sql.ts";
import { toOutboxEvent } from "../../outbox/outbox-event.ts";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
import type { Assignment, Catalog, Draft, Rules, CapturedEvidence } from "./types.ts";
export interface Snapshots {
  readonly catalog: Catalog | null;
  readonly rules: Rules | null;
  readonly assignment: Assignment | null;
}
export interface StoredCapture {
  readonly draft: Draft | null;
  readonly event: OutboxEvent | null;
  readonly draftVersion: string | null;
}
/** SQLite is the only source of saved status; local projections retain every captured version. */
export class OvitrapStore {
  readonly #db: SqlExecutor;
  readonly #kv: KvStore;
  constructor(db: SqlExecutor) {
    this.#db = db;
    this.#kv = new KvStore(db);
  }
  async read(): Promise<StoredCapture> {
    const [row] = await this.#db.query("SELECT draft, event_id FROM ovitrap_draft WHERE slot = 1");
    if (!row) return { draft: null, event: null, draftVersion: null };
    return {
      draft: JSON.parse(readText(row, "draft")) as Draft,
      event: typeof row.event_id === "string" ? await this.event(row.event_id) : null,
      draftVersion: readText(row, "draft"),
    };
  }
  async event(id: string): Promise<OutboxEvent | null> {
    const [row] = await this.#db.query("SELECT * FROM outbox_event WHERE id = ?", [id]);
    return row ? toOutboxEvent(row) : null;
  }
  async snapshots(): Promise<Snapshots> {
    const saved = await this.#kv.get("ovitrap_snapshots");
    return saved
      ? (JSON.parse(saved) as Snapshots)
      : { catalog: null, rules: null, assignment: null };
  }
  async saveSnapshots(snapshots: Snapshots): Promise<void> {
    await this.#kv.set("ovitrap_snapshots", JSON.stringify(snapshots));
  }
  async begin(draft: Draft): Promise<void> {
    await this.#db.runAtomically([
      {
        sql: `INSERT INTO ovitrap_superseded_draft(event_id, replacement_event_id, draft)
          SELECT json_extract(draft, '$.eventId'), ?, draft FROM ovitrap_draft
          WHERE slot = 1 AND event_id IS NULL AND json_extract(draft, '$.shiftId') <> ?`,
        params: [draft.eventId, draft.shiftId],
      },
      {
        sql: `INSERT INTO ovitrap_draft(slot, draft) VALUES (1, ?) ON CONFLICT(slot) DO UPDATE SET draft = excluded.draft, event_id = NULL
          WHERE ovitrap_draft.event_id IS NOT NULL OR json_extract(ovitrap_draft.draft, '$.shiftId') <> json_extract(excluded.draft, '$.shiftId')`,
        params: [JSON.stringify(draft)],
      },
    ]);
  }
  async update(draft: Draft, expectedVersion: string | null): Promise<boolean> {
    const rows = await this.#db.query(
      "UPDATE ovitrap_draft SET draft = ? WHERE slot = 1 AND event_id IS NULL AND json_extract(draft, '$.eventId') = ? AND draft=? RETURNING slot",
      [JSON.stringify(draft), draft.eventId, expectedVersion],
    );
    return rows.length === 1;
  }
  evidenceCaptureGuard(draftId: string): SqlStatement {
    return {
      sql: "SELECT 1 FROM ovitrap_draft WHERE slot=1 AND event_id IS NULL AND json_extract(draft,'$.eventId')=?",
      params: [draftId],
    };
  }
  evidencePublicationGuard(input: {
    draft: Draft;
    assignment: Assignment | null;
    shift: SqlStatement;
  }): SqlStatement {
    const fields = ["eventId", "mode", "ovitrapId", "shiftId", "point", "assignment"];
    const target = fields
      .map(
        (field) =>
          `json_extract(d.draft,'$.${field}') IS json_extract(original.value,'$.${field}')`,
      )
      .join(" AND ");
    return {
      sql: `SELECT 1 FROM ovitrap_draft d, (SELECT ? AS value, ? AS assignment) original
        WHERE d.slot=1 AND d.event_id IS NULL AND ${target}
        AND EXISTS(SELECT 1 FROM kv WHERE key='ovitrap_snapshots'
          AND json_extract(value,'$.assignment') IS json_extract(original.assignment,'$'))
        AND EXISTS(${input.shift.sql})`,
      params: [
        JSON.stringify(input.draft),
        JSON.stringify(input.assignment),
        ...(input.shift.params ?? []),
      ],
    };
  }
  async publishEvidence(input: {
    captured: CapturedEvidence;
    guard: SqlStatement;
  }): Promise<boolean> {
    const { captured, guard } = input;
    const evidence = { id: captured.id, fileRef: captured.fileRef };
    const rows = await this.#db.query(
      `UPDATE ovitrap_draft SET draft=json_set(draft,'$.evidence',
        json_insert(json_extract(draft,'$.evidence'),'$[#]',json(?)))
        WHERE slot=1 AND event_id IS NULL AND EXISTS(${guard.sql}) AND EXISTS(${captured.authority.sql})
        AND NOT EXISTS(SELECT 1 FROM json_each(draft,'$.evidence') WHERE json_extract(value,'$.id')=?) RETURNING slot`,
      [
        JSON.stringify(evidence),
        ...(guard.params ?? []),
        ...(captured.authority.params ?? []),
        captured.id,
      ],
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
  commitStatements(draft: Draft, expectedVersion: string | null): readonly SqlStatement[] {
    const week = captureWeek(draft);
    if (!week) throw new Error("Capture blocked: weekContext");
    return [
      ...this.#lineage(draft),
      {
        sql: `INSERT INTO ovitrap_capture(event_id, ovitrap_id, mode, epi_week, draft)
          VALUES (?, (SELECT ? FROM ovitrap_draft WHERE slot=1 AND event_id IS NULL AND draft=?), ?, ?, ?)`,
        params: [
          draft.eventId,
          draft.ovitrapId,
          expectedVersion,
          draft.mode,
          week,
          JSON.stringify(draft),
        ],
      },
      ...this.#evidenceStatements(draft),
      {
        sql: "UPDATE ovitrap_draft SET draft = ?, event_id = ? WHERE slot = 1",
        params: [JSON.stringify(draft), draft.eventId],
      },
    ];
  }
  #evidenceStatements(draft: Draft): readonly SqlStatement[] {
    return Array.from(
      new Map([...draft.sourceEvidence, ...draft.evidence].map((item) => [item.id, item])).values(),
    ).map((evidence) => ({
      sql: "INSERT INTO ovitrap_evidence(event_id, evidence_id, file_ref) VALUES (?, ?, ?)",
      params: [draft.eventId, evidence.id, evidence.fileRef],
    }));
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
