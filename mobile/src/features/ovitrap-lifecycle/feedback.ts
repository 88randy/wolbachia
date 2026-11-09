import type { Schemas } from "@wolbachia/api-client";
import type { SqlExecutor } from "../../db/sql.ts";
import { readText } from "../../db/sql.ts";
import { ownerKey } from "../../attachments/types.ts";
import { CURRENT_CAPTURE_CONTEXT } from "./context-sql.ts";
import { readHistoryEntry } from "./history-contract.ts";
import { retainedProposal } from "./retained-proposal.ts";
import { readCurrentTask } from "../day/current-task.ts";
import type { CaptureTransportHandle } from "./capture-context-contract.ts";
const ACTIVE_HISTORY = `SELECT history.body FROM lifecycle_courier_projection history
  JOIN (${CURRENT_CAPTURE_CONTEXT}) context ON json_extract(context.value,'$.ownerKey')=?
    AND json_extract(context.value,'$.sessionId')=? AND json_extract(context.value,'$.authorityRevision')=?
  WHERE history.kind IN ('history.review_decision','history.shift_validation','history.relocation_proposal','history.transfer_custody')
    AND json_extract(history.body,'$._available') IS NOT 0 ORDER BY history.sequence,history.id`;
/** The downloaded writer proves this current observation; DTO self fields never prove its owner. */
export async function activeFeedback(db: SqlExecutor, handle: CaptureTransportHandle) {
  if (!handle.isCurrent()) return [];
  const rows = await db.query(ACTIVE_HISTORY, [
    ownerKey(handle.owner),
    handle.sessionId,
    handle.revision,
  ]);
  return handle.isCurrent()
    ? rows.map((row) => readHistoryEntry(JSON.parse(readText(row, "body"))))
    : [];
}
export async function proposalFeedback(
  db: SqlExecutor,
  input: {
    readonly eventId: string;
    readonly pointId: string;
    readonly handle: CaptureTransportHandle;
    readonly observed?: readonly Schemas["CourierHistoryEntry"][];
  },
) {
  const { eventId, pointId, handle, observed } = input;
  const entries = observed ?? (await activeFeedback(db, handle));
  const proposal = entries.find(
    (entry): entry is Schemas["RelocationHistoryEntry"] =>
      entry.kind === "relocation_proposal" &&
      entry.proposal_event_id === eventId &&
      entry.point_id === pointId,
  );
  const retained = proposal ? null : await retainedProposal(db, eventId, handle);
  return { proposal: proposal ?? null, retained: retained?.pointId === pointId ? retained : null };
}
/** A scheduled reference is not an assignment. Only its exact current v3 row can enable action. */
export async function isCurrentTask(
  db: SqlExecutor,
  id: string,
  input: { readonly pointId: string; readonly handle: CaptureTransportHandle },
) {
  const { pointId, handle } = input;
  const row = await readCurrentTask(db, id, { courier: handle.owner.userId, pointId });
  return Boolean(row) && handle.isCurrent();
}
export function sourceReviews(
  entries: readonly Schemas["CourierHistoryEntry"][],
  eventId: string,
  shiftId: string,
) {
  return entries.filter(
    (entry): entry is Schemas["ReviewHistoryEntry"] =>
      (entry.kind === "review_decision" && entry.source_event_id === eventId) ||
      (entry.kind === "shift_validation" && entry.shift_id === shiftId),
  );
}
