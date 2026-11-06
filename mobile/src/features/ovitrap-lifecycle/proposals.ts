import { readText } from "../../db/sql.ts";
import type { SqlExecutor, SqlStatement } from "../../db/sql.ts";
import { OvitrapStore } from "../ovitrap-check/store.ts";
import { UUID_PATTERN } from "../ovitrap-check/domain.ts";
import type {
  HistoryItem,
  LifecycleDraft,
  RelocationDecision,
  RelocationProposal,
} from "./types.ts";
export async function readProposal(
  db: SqlExecutor,
  eventId: string,
): Promise<RelocationProposal | null> {
  const [row] = await db.query(
    "SELECT draft FROM lifecycle_capture WHERE event_id=? AND kind='relocate'",
    [eventId],
  );
  if (!row) return null;
  const draft = JSON.parse(readText(row, "draft")) as LifecycleDraft;
  if (!draft.proposedLocation) throw new Error("Proposal location missing.");
  const [latest] = await db.query(
    "SELECT decision FROM lifecycle_decision WHERE proposal_event_id=? ORDER BY decided_at DESC,id DESC LIMIT 1",
    [eventId],
  );
  const decision = latest ? (JSON.parse(readText(latest, "decision")) as RelocationDecision) : null;
  const voids = await db.query(
    "SELECT v.event_id FROM lifecycle_void v JOIN outbox_event e ON e.id=v.event_id WHERE v.target_event_id=? AND e.local_status NOT IN ('rejected','in_review')",
    [eventId],
  );
  return {
    eventId,
    status: decision?.status ?? "proposed",
    proposedLocation: draft.proposedLocation,
    isVoided: voids.length > 0,
    decision,
    nextDayTask: decision?.nextDayTask ?? null,
  };
}
async function historyItem(db: SqlExecutor, draft: LifecycleDraft): Promise<HistoryItem> {
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
    proposal: await readProposal(db, draft.eventId),
  };
}
export async function readHistory(
  db: SqlExecutor,
  pointId: string,
): Promise<readonly HistoryItem[]> {
  const rows = await db.query(
    "SELECT draft FROM lifecycle_capture WHERE point_id=? ORDER BY rowid DESC",
    [pointId],
  );
  return Promise.all(
    rows.map((row) => historyItem(db, JSON.parse(readText(row, "draft")) as LifecycleDraft)),
  );
}
function validateDecision(decision: RelocationDecision): void {
  if (
    !UUID_PATTERN.test(decision.id) ||
    !UUID_PATTERN.test(decision.proposalEventId) ||
    !["approved", "rejected"].includes(decision.status) ||
    !Number.isFinite(Date.parse(decision.decidedAt)) ||
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
      new Date(decision.decidedAt).toISOString(),
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
