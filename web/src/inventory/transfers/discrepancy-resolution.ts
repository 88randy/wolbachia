import type { Schemas } from "@wolbachia/api-client";
import type { VoidLimits } from "../../void/void-limits";
import type { Discrepancy } from "./discrepancy-query";

export interface DiscrepancyOutcomeDraft {
  kind: "" | Schemas["ClosedOutcomeRequest"]["kind"];
  signatureId?: string;
  correctionTransferId?: string;
  receiptId?: string;
}
export interface DiscrepancyDraft {
  reason: string;
  evidenceId: string;
  outcomes: Record<string, DiscrepancyOutcomeDraft>;
}
/** A completed upload may add evidence only to the currently selected receiving outcome. */
export function applyDiscrepancySignature(
  draft: DiscrepancyDraft,
  proof: { lineId: string; signatureId: string },
): DiscrepancyDraft {
  const outcome = draft.outcomes[proof.lineId];
  if (outcome?.kind !== "recover_dest" && outcome?.kind !== "return_origin") return draft;
  return {
    ...draft,
    outcomes: { ...draft.outcomes, [proof.lineId]: { ...outcome, signatureId: proof.signatureId } },
  };
}
function buildOutcome(
  record: Discrepancy,
  line: Schemas["DiscrepancyLine"],
  draft?: DiscrepancyOutcomeDraft,
): Schemas["ClosedOutcomeRequest"] | null {
  if (!draft?.kind) return null;
  const base = { line_id: line.id, quantity: line.quantity };
  if (draft.kind === "reference_signed_correction") return buildCorrectionOutcome(base, draft);
  if (line.kind !== "missing") return null;
  if (draft.kind === "ack_missing") return { ...base, kind: draft.kind };
  return buildReceivingOutcome(record, base, draft);
}
function buildCorrectionOutcome(
  base: { line_id: string; quantity: string },
  draft: DiscrepancyOutcomeDraft,
): Schemas["CorrectionOutcomeRequest"] | null {
  if (!draft.correctionTransferId || !draft.receiptId) return null;
  return {
    ...base,
    kind: "reference_signed_correction",
    correction_transfer_id: draft.correctionTransferId,
    receipt_event_id: draft.receiptId,
  };
}
function buildReceivingOutcome(
  record: Discrepancy,
  base: { line_id: string; quantity: string },
  draft: DiscrepancyOutcomeDraft,
): Schemas["ReceivingOutcomeRequest"] | null {
  if (draft.kind !== "recover_dest" && draft.kind !== "return_origin") return null;
  const dispatch = record.transfer.events.find((event) => event.kind === "dispatch");
  return draft.signatureId && dispatch
    ? {
        ...base,
        kind: draft.kind,
        signature_upload_id: draft.signatureId,
        dispatch_event_id: dispatch.id,
        receipt_event_id: record.receipt_event_id,
      }
    : null;
}
function isIncomplete(outcomes: (Schemas["ClosedOutcomeRequest"] | null)[], evidenceId: string) {
  return outcomes.some(
    (outcome) =>
      !outcome || (["recover_dest", "return_origin"].includes(outcome.kind) && !evidenceId),
  );
}
/** Each disposition covers the exact complete saved line; no inferred balance or float quantity. */
export function buildDiscrepancyClose(
  record: Discrepancy,
  draft: DiscrepancyDraft,
  limits: VoidLimits,
): Schemas["CloseDiscrepancyRequest"] | null {
  const reason = draft.reason.trim();
  if (reason.length < limits.minLength || reason.length > limits.maxLength) return null;
  const outcomes = record.lines.map((line) => buildOutcome(record, line, draft.outcomes[line.id]));
  if (isIncomplete(outcomes, draft.evidenceId)) return null;
  const complete = outcomes.filter(
    (outcome): outcome is Schemas["ClosedOutcomeRequest"] => outcome !== null,
  );
  return {
    expected_revision: record.revision,
    reason,
    evidence_ids: draft.evidenceId ? [draft.evidenceId] : [],
    resolution: { outcomes: complete },
  };
}
