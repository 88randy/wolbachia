import type { Schemas } from "@wolbachia/api-client";
import { readSupplyAssignment } from "../supply-receipt/projection-contract.ts";
import { readSupplyAssignments } from "../supply-receipt/projection-state.ts";
import { SupplyProjectionUnavailable } from "../supply-receipt/projection-types.ts";
import type { EvidenceIdentity } from "../../attachments/evidence-session.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import { readCaptureTransport } from "../ovitrap-lifecycle/context-state.ts";

export interface SupplySource {
  readonly id: string;
  readonly shiftId: string | null;
  readonly originId: string;
  readonly date: string;
  readonly revision: number;
  readonly frame: Schemas["SupplyFrameLine"][];
  readonly receipts: Schemas["SupplyReceiptBundle"][];
}

/** Copy canonical received custody and usage; local receipt drafts are not server credit. */
export function readSupplySource(value: unknown): SupplySource {
  const assignment = readSupplyAssignment(value);
  return {
    id: assignment.id,
    date: assignment.date,
    shiftId: assignment.shift_id,
    originId: assignment.origin_id,
    revision: assignment.reconciliation?.revision ?? 0,
    frame: assignment.reconciliation?.frame?.lines ?? [],
    receipts: assignment.receipts,
  };
}

/** Caller owns the existing projection writer; this read never acquires it again. */
export async function readClosingSupplies(
  db: SqlExecutor,
  input: { readonly identity: EvidenceIdentity | null; readonly isCurrent: () => boolean },
) {
  const handle = await readCaptureTransport(db, input.identity, input.isCurrent);
  if (handle === null) throw new SupplyProjectionUnavailable("Supply capture context unavailable.");
  return readSupplyAssignments(db, handle, "reconcile");
}
