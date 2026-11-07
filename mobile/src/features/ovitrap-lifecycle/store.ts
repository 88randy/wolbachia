import { KvStore } from "../../db/kv-store.ts";
import { readText } from "../../db/sql.ts";
import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import { OvitrapStore } from "../ovitrap-check/store.ts";
import { StaleCaptureError } from "../ovitrap-check/capture-identity.ts";
import type {
  Configuration,
  LifecycleDraft,
  StoredLifecycle,
  RelocationDecision,
} from "./types.ts";
import { physicalOvitrap } from "./physical-projection.ts";
import { readHistory, readProposal, decisionStatement } from "./proposals.ts";
import { lifecycleStatements } from "./store-statements.ts";
export function identityGuard(eventId: string | null): SqlStatement {
  return {
    sql: `INSERT INTO lifecycle_guard(slot,value) VALUES (1,
    CASE WHEN (SELECT json_extract(draft,'$.eventId') FROM lifecycle_draft WHERE slot = 1) IS ? THEN 1 ELSE 0 END)
    ON CONFLICT(slot) DO UPDATE SET value = excluded.value`,
    params: [eventId],
  };
}
export class LifecycleStore {
  readonly db: SqlExecutor;
  readonly capture: OvitrapStore;
  readonly #kv: KvStore;
  constructor(db: SqlExecutor) {
    this.db = db;
    this.capture = new OvitrapStore(db);
    this.#kv = new KvStore(db);
  }
  async read(): Promise<StoredLifecycle> {
    const [row] = await this.db.query("SELECT draft,event_id FROM lifecycle_draft WHERE slot = 1");
    if (!row) return { draft: null, event: null, proposal: null, history: [] };
    const draft = JSON.parse(readText(row, "draft")) as LifecycleDraft;
    return {
      draft,
      event: typeof row.event_id === "string" ? await this.capture.event(row.event_id) : null,
      proposal: await readProposal(this.db, draft.eventId),
      history: await readHistory(this.db, draft.point.id),
    };
  }
  async configuration(): Promise<Configuration> {
    const raw = await this.#kv.get("lifecycle_configuration");
    return raw ? (JSON.parse(raw) as Configuration) : { catalog: null, rules: null };
  }
  saveConfiguration(configuration: Configuration): Promise<void> {
    return this.#kv.set("lifecycle_configuration", JSON.stringify(configuration));
  }
  physical(id: string) {
    return physicalOvitrap(this.db, id);
  }
  async begin(draft: LifecycleDraft, eventId: string | null): Promise<void> {
    await this.db.runAtomically(this.beginStatements(draft, eventId));
  }
  /** Ordinary restore/update path: this NEVER creates or reseals ownership. */
  beginStatements(draft: LifecycleDraft, eventId: string | null): readonly SqlStatement[] {
    const reserve: SqlStatement[] = draft.replacementId
      ? [
          {
            sql: "INSERT INTO lifecycle_identity(id,event_id) VALUES (?,?)",
            params: [draft.replacementId, draft.eventId],
          },
        ]
      : [];
    return [
      identityGuard(eventId),
      ...reserve,
      {
        sql: `INSERT OR IGNORE INTO lifecycle_archive(event_id,draft) SELECT json_extract(draft,'$.eventId'),draft FROM lifecycle_draft WHERE slot = 1`,
      },
      {
        sql: `INSERT INTO lifecycle_draft(slot,draft) VALUES(1,?) ON CONFLICT(slot) DO UPDATE SET draft=excluded.draft,event_id=NULL`,
        params: [JSON.stringify(draft)],
      },
    ];
  }
  async update(draft: LifecycleDraft): Promise<void> {
    const rows = await this.db.query(
      `UPDATE lifecycle_draft SET draft=? WHERE slot=1 AND event_id IS NULL AND json_extract(draft,'$.eventId')=? RETURNING slot`,
      [JSON.stringify(draft), draft.eventId],
    );
    if (!rows.length) throw new StaleCaptureError();
  }
  commitStatements(draft: LifecycleDraft): readonly SqlStatement[] {
    return [identityGuard(draft.eventId), ...lifecycleStatements(draft)];
  }
  /** Local typed ingest seam ONLY. B-33 has no documented producer/wire decoder yet. */
  async ingestDecision(decision: RelocationDecision): Promise<void> {
    const statement = await decisionStatement(this.db, decision);
    if (statement) await this.db.runAtomically([statement]);
  }
  history(pointId: string) {
    return readHistory(this.db, pointId);
  }
}
