import { localProposal, currentProposal } from "./proposal-model.ts";
import { readText } from "../../db/sql.ts";
import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import { OvitrapStore } from "../ovitrap-check/store.ts";
import { UUID_PATTERN } from "../ovitrap-check/domain.ts";
import { readLifecycleDraft } from "./draft-context.ts";
import { ownerKey } from "../../attachments/types.ts";
import type { CaptureTransportHandle } from "./capture-context-contract.ts";
import { activeFeedback, proposalFeedback, sourceReviews, isCurrentTask } from "./feedback.ts";
import type { Schemas } from "@wolbachia/api-client";
import type {
  HistoryItem,
  LifecycleDraft,
  RelocationDecision,
  RelocationProposal,
} from "./types.ts";
interface Observation {
  readonly handle?: CaptureTransportHandle;
  readonly entries?: readonly Schemas["CourierHistoryEntry"][];
}
export async function readProposal(
  db: SqlExecutor,
  eventId: string,
  observation: Observation = {},
): Promise<RelocationProposal | null> {
  const [row] = await db.query(
    "SELECT draft FROM lifecycle_capture WHERE event_id=? AND kind='relocate'",
    [eventId],
  );
  if (!row) return null;
  const draft = readLifecycleDraft(JSON.parse(readText(row, "draft")));
  const [latest] = await db.query(
    "SELECT decision FROM lifecycle_decision WHERE proposal_event_id=? ORDER BY decided_at DESC,id DESC LIMIT 1",
    [eventId],
  );
  const decision = latest ? (JSON.parse(readText(latest, "decision")) as RelocationDecision) : null;
  const voids = await db.query(
    "SELECT v.event_id FROM lifecycle_void v JOIN outbox_event e ON e.id=v.event_id WHERE v.target_event_id=? AND e.local_status NOT IN ('rejected','in_review')",
    [eventId],
  );
  const base = localProposal(draft, decision, voids.length > 0),
    { handle } = observation;
  if (!handle) return base;
  return observedProposal(db, base, {
    pointId: draft.point.id,
    handle,
    entries: observation.entries,
  });
}
async function observedProposal(
  db: SqlExecutor,
  base: RelocationProposal,
  input: { pointId: string; handle: CaptureTransportHandle; entries?: Observation["entries"] },
) {
  const { pointId, handle, entries } = input;
  const { proposal: entry, retained } = await proposalFeedback(db, {
    eventId: base.eventId,
    pointId,
    handle,
    observed: entries,
  });
  const task = entry?.next_day_task;
  const actionable = task ? await isCurrentTask(db, task.id, { pointId, handle }) : false;
  return currentProposal({ base, entry, retained, isTaskActionable: actionable });
}
async function historyItem(
  db: SqlExecutor,
  draft: LifecycleDraft,
  observation: Observation,
): Promise<HistoryItem> {
  const capture = new OvitrapStore(db);
  const event = await capture.event(draft.eventId);
  if (!event) throw new Error("Lifecycle event missing.");
  const corrections = await readCorrections(db, draft.eventId);
  const [voided] = await db.query(
    "SELECT event_id,reason FROM lifecycle_void WHERE target_event_id=? ORDER BY rowid DESC LIMIT 1",
    [draft.eventId],
  );
  return {
    corrections,
    draft,
    event,
    voidReason: voided ? readText(voided, "reason") : null,
    voidEvent: voided ? await capture.event(readText(voided, "event_id")) : null,
    proposal: await readProposal(db, draft.eventId, observation),
    reviews: sourceReviews(observation.entries ?? [], draft.eventId, draft.shiftId),
  };
}
export async function readHistory(
  db: SqlExecutor,
  pointId: string,
  observation: Observation = {},
): Promise<readonly HistoryItem[]> {
  const { handle, entries: feedback } = observation;
  const rows = await db.query(
    `SELECT draft FROM lifecycle_capture c WHERE point_id=? ${
      handle
        ? `AND EXISTS(
      SELECT 1 FROM lifecycle_courier_projection source WHERE source.kind='lifecycle.owned-source' AND source.id=c.event_id
        AND json_extract(source.body,'$.ownerKey')=?)`
        : ""
    } ORDER BY rowid DESC`,
    handle ? [pointId, ownerKey(handle.owner)] : [pointId],
  );
  const entries = feedback ?? (handle ? await activeFeedback(db, handle) : []);
  return Promise.all(
    rows.map((row) =>
      historyItem(db, readLifecycleDraft(JSON.parse(readText(row, "draft"))), { handle, entries }),
    ),
  );
}
function validateDecision(decision: RelocationDecision): void {
  if (
    !UUID_PATTERN.test(decision.id) ||
    !UUID_PATTERN.test(decision.proposalEventId) ||
    !["approved", "rejected"].includes(decision.status) ||
    !Number.isFinite(Date.parse(decision.decidedAt ?? "")) ||
    typeof decision.reason !== "string" ||
    decision.reason.length > 1000
  )
    throw new Error("Invalid local relocation decision.");
  validateTask(decision.nextDayTask);
}
function validateTask(task: RelocationDecision["nextDayTask"]): void {
  if (
    task &&
    (!UUID_PATTERN.test(task.id) || !task.code || !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate))
  )
    throw new Error("Invalid synced relocation task.");
}
export async function decisionStatement(
  db: SqlExecutor,
  decision: RelocationDecision,
): Promise<SqlStatement | null> {
  validateDecision(decision);
  const proposal = await readProposal(db, decision.proposalEventId);
  if (!proposal) throw new Error("Unknown local relocation proposal.");
  const serialized = JSON.stringify(decision);
  const [existing] = await db.query("SELECT decision FROM lifecycle_decision WHERE id=?", [
    decision.id,
  ]);
  if (existing) {
    if (readText(existing, "decision") !== serialized)
      throw new Error("Immutable decision conflict.");
    return null;
  }
  return {
    sql: "INSERT INTO lifecycle_decision(id,proposal_event_id,decided_at,decision) VALUES(?,?,?,?)",
    params: [
      decision.id,
      decision.proposalEventId,
      new Date(decision.decidedAt ?? "").toISOString(),
      serialized,
    ],
  };
}

async function readCorrections(db: SqlExecutor, eventId: string) {
  const rows = await db.query(
    "SELECT event_id,reason FROM lifecycle_void WHERE target_event_id=? ORDER BY rowid",
    [eventId],
  );
  const capture = new OvitrapStore(db);
  return Promise.all(
    rows.map(async (row) => {
      const event = await capture.event(readText(row, "event_id"));
      if (!event) throw new Error("Missing correction event.");
      return { event, reason: readText(row, "reason") };
    }),
  );
}
