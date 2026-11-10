import type { Schemas } from "@wolbachia/api-client";
import { DiscrepancyReceivingEvidence } from "./DiscrepancyReceivingEvidence";
import { DiscrepancyCorrection } from "./DiscrepancyCorrection";
import type { DiscrepancyRecordState } from "./discrepancy-use-record";

export function DiscrepancyOutcomeEvidence({
  state,
  line,
}: {
  state: DiscrepancyRecordState;
  line: Schemas["DiscrepancyLine"];
}) {
  const kind = state.draft.outcomes[line.id]?.kind ?? "";
  const permissions = state.scope.identity.permissions ?? [];
  if (["recover_dest", "return_origin"].includes(kind) && permissions.includes("transfer.receive"))
    return <DiscrepancyReceivingEvidence state={state} line={line} />;
  if (kind === "reference_signed_correction" && permissions.includes("transfer.read"))
    return <DiscrepancyCorrection state={state} line={line} />;
  return null;
}
