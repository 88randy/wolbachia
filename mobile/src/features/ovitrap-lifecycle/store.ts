import { KvStore } from "../../db/kv-store.ts";
import { readText } from "../../db/sql.ts";
import { CURRENT_FENCE, fenceParams } from "../../attachments/attachment-store.ts";
import { ownerKey } from "../../attachments/types.ts";
import { CURRENT_CAPTURE_CONTEXT } from "./context-sql.ts";
import { readLifecycleDraft } from "./draft-context.ts";
import { lifecycleCommitGuards } from "./new-owned-draft.ts";
import { boundConfiguration } from "./source-context.ts";
import { CourierContractError } from "./contract-readers.ts";
import type { CaptureTransportHandle } from "./capture-context-contract.ts";
import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import { OvitrapStore } from "../ovitrap-check/store.ts";
import { StaleCaptureError } from "../ovitrap-check/capture-identity.ts";
import type {
  Configuration,
  LifecycleDraft,
  StoredLifecycle,
  RelocationDecision,
  LifecycleSourceTurn,
} from "./types.ts";
import { physicalOvitrap } from "./physical-projection.ts";
import { readHistory, readProposal, decisionStatement } from "./proposals.ts";
import { activeFeedback, sourceReviews } from "./feedback.ts";
import type { Schemas } from "@wolbachia/api-client";
import { readQuadrantReference } from "./quadrant-contract.ts";
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
  /** Internal storage read only; display/actions must use readOwned under a proven original turn. */
  async read(turn?: LifecycleSourceTurn): Promise<StoredLifecycle> {
    const [row] = await this.db.query("SELECT draft,event_id FROM lifecycle_draft WHERE slot = 1");
    if (!row) return { draft: null, event: null, proposal: null, history: [] };
    const draft = readLifecycleDraft(JSON.parse(readText(row, "draft")));
    const feedback = turn ? await activeFeedback(this.db, turn.handle) : [];
    return {
      draft,
      event: typeof row.event_id === "string" ? await this.capture.event(row.event_id) : null,
      proposal: await readProposal(this.db, draft.eventId, {
        handle: turn?.handle,
        entries: feedback,
      }),
      history: await readHistory(this.db, draft.point.id, {
        handle: turn?.handle,
        entries: feedback,
      }),
      reviews: sourceReviews(feedback, draft.eventId, draft.shiftId),
      remoteProposals: feedback.filter(
        (entry): entry is Schemas["RelocationHistoryEntry"] =>
          entry.kind === "relocation_proposal" &&
          entry.point_id === draft.point.id &&
          entry.proposal_event_id !== draft.eventId,
      ),
    };
  }
  async readOwned(turn: LifecycleSourceTurn | null): Promise<StoredLifecycle> {
    const [stored] = await this.db.query("SELECT 1 AS present FROM lifecycle_draft WHERE slot=1");
    const blocked = {
      draft: null,
      event: null,
      proposal: null,
      history: [],
      ...(stored ? { recovery: "blocked_ownership" as const } : {}),
    };
    if (turn === null || !(await this.#canRead(turn))) return blocked;
    let result: StoredLifecycle;
    try {
      result = await this.read(turn);
    } catch (error) {
      if (error instanceof CourierContractError)
        return { ...blocked, recovery: "unsupported_draft" };
      throw error;
    }
    return (await this.#canRead(turn)) ? result : blocked;
  }
  async #canRead(turn: LifecycleSourceTurn): Promise<boolean> {
    if (!turn.handle.isCurrent()) return false;
    const [row] = await this.db.query(
      `SELECT 1 FROM lifecycle_draft draft
      JOIN lifecycle_courier_projection origin ON origin.id=json_extract(draft.draft,'$.eventId')
        AND origin.kind IN ('lifecycle.owned-draft','lifecycle.owned-source')
        AND json_extract(origin.body,'$.pointId')=json_extract(draft.draft,'$.point.id')
        AND json_extract(origin.body,'$.ovitrapId')=json_extract(draft.draft,'$.ovitrapId')
        AND json_extract(origin.body,'$.kind')=json_extract(draft.draft,'$.kind')
        AND (json_extract(origin.body,'$.draftSchemaVersion') IS NOT 2 OR json_extract(draft.draft,'$.schemaVersion')=2)
      JOIN (${CURRENT_CAPTURE_CONTEXT}) context ON json_extract(origin.body,'$.ownerKey')=json_extract(context.value,'$.ownerKey')
      WHERE json_extract(context.value,'$.ownerKey')=? AND json_extract(context.value,'$.sessionId')=?
        AND json_extract(context.value,'$.authorityRevision')=? AND ${CURRENT_FENCE} LIMIT 1`,
      [
        ownerKey(turn.handle.owner),
        turn.handle.sessionId,
        turn.handle.revision,
        ...fenceParams(turn.ownerFence),
      ],
    );
    return Boolean(row) && turn.handle.isCurrent();
  }
  async configuration(handle?: CaptureTransportHandle): Promise<Configuration> {
    const raw = await this.#kv.get("lifecycle_configuration");
    if (handle) return boundConfiguration(raw, handle);
    return raw ? (JSON.parse(raw) as Configuration) : { catalog: null, rules: null };
  }
  saveConfiguration(configuration: Configuration, turn?: LifecycleSourceTurn): Promise<void> {
    if (!turn) return this.#kv.set("lifecycle_configuration", JSON.stringify(configuration));
    return this.db.runAtomically([
      ...lifecycleCommitGuards(turn.handle, turn.ownerFence),
      {
        sql: "INSERT INTO kv(key,value) VALUES('lifecycle_configuration',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params: [
          JSON.stringify({
            ...configuration,
            captureBinding: {
              ownerKey: ownerKey(turn.handle.owner),
              sessionId: turn.handle.sessionId,
              revision: turn.handle.revision,
            },
          }),
        ],
      },
    ]);
  }
  physical(id: string) {
    return physicalOvitrap(this.db, id);
  }
  async frameState(
    pointId: string,
    turn: LifecycleSourceTurn | null,
  ): Promise<"open" | "closed" | "unknown"> {
    if (!turn) return "unknown";
    const [row] = await this.db.query(
      `SELECT quadrant.body FROM day_sampling_point point
      JOIN lifecycle_courier_projection quadrant ON quadrant.kind='quadrant' AND quadrant.id=json_extract(point.payload,'$.quadrant_id')
      JOIN (${CURRENT_CAPTURE_CONTEXT}) context ON json_extract(context.value,'$.ownerKey')=?
        AND json_extract(context.value,'$.sessionId')=? AND json_extract(context.value,'$.authorityRevision')=?
      WHERE point.id=? AND point.removed=0`,
      [ownerKey(turn.handle.owner), turn.handle.sessionId, turn.handle.revision, pointId],
    );
    if (!row) return "unknown";
    try {
      const { closure } = readQuadrantReference(JSON.parse(readText(row, "body")));
      return closure.kind === "open" || closure.kind === "closed" ? closure.kind : "unknown";
    } catch (error) {
      if (error instanceof CourierContractError) return "unknown";
      throw error;
    }
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
  async update(draft: LifecycleDraft, turn?: LifecycleSourceTurn): Promise<void> {
    if (turn) {
      await this.db.runAtomically([
        ...lifecycleCommitGuards(turn.handle, turn.ownerFence),
        identityGuard(draft.eventId),
        {
          sql: `INSERT INTO lifecycle_guard(slot,value) SELECT 1,CASE WHEN event_id IS NULL THEN 1 ELSE 0 END FROM lifecycle_draft WHERE slot=1
          ON CONFLICT(slot) DO UPDATE SET value=excluded.value`,
        },
        { sql: "UPDATE lifecycle_draft SET draft=? WHERE slot=1", params: [JSON.stringify(draft)] },
      ]);
      return;
    }
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
