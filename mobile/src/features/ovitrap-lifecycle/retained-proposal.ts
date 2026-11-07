import type { Schemas } from "@wolbachia/api-client";
import type { SqlExecutor } from "../../db/sql.ts";
import { readText } from "../../db/sql.ts";
import { ownerKey } from "../../attachments/types.ts";
import type { CaptureTransportHandle } from "./capture-context-contract.ts";
import { CURRENT_CAPTURE_CONTEXT } from "./context-sql.ts";
export interface RetainedProposal {
  readonly sourceEventId: string;
  readonly pointId: string;
  readonly proposalId: string;
  readonly ownerKey: string;
  readonly decision: Schemas["RelocationHistoryDecision"];
}
/** A fresh current read session may access its own proven historical source, never adopt one. */
export async function retainedProposal(
  db: SqlExecutor,
  eventId: string,
  handle: CaptureTransportHandle | null,
): Promise<RetainedProposal | null> {
  if (handle === null || !handle.isCurrent()) return null;
  const [row] = await db.query(
    `SELECT proof.body FROM lifecycle_courier_projection proof
    JOIN (${CURRENT_CAPTURE_CONTEXT}) context
      ON json_extract(context.value,'$.ownerKey')=json_extract(proof.body,'$.ownerKey')
    WHERE proof.kind='lifecycle.reviewed-proposal' AND proof.id=?
      AND json_extract(context.value,'$.ownerKey')=? AND json_extract(context.value,'$.sessionId')=?
      AND json_extract(context.value,'$.authorityRevision')=?`,
    [eventId, ownerKey(handle.owner), handle.sessionId, handle.revision],
  );
  if (!handle.isCurrent() || !row) return null;
  return JSON.parse(readText(row, "body")) as RetainedProposal;
}
