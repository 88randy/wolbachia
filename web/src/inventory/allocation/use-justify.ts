import type { MessageKey } from "@wolbachia/i18n";
import type { AllocationScope } from "./allocation-query";
import type { ReconciliationRow } from "./reconciliation-equation";
import { useAllocationCommand } from "./use-allocation-command";
import { useReasonFields } from "./use-reason-fields";
import type { ReasonFields } from "./use-reason-fields";

function blockerOf(reason: ReasonFields, discrepancyId: string | null): MessageKey | null {
  if (discrepancyId === null) return "allocation.reconciliation.noDiscrepancy";
  if (reason.reasonCode === "") return "allocation.writeOff.blockerReason";
  const isShort = reason.reason.trim().length < reason.minReasonLength;
  return reason.isOtherReason && isShort ? "allocation.writeOff.blockerReasonText" : null;
}

/** Justification posts the saved difference with the revision the user saw; a conflict keeps the text. */
export function useJustify(scope: AllocationScope, row: ReconciliationRow) {
  const reason = useReasonFields();
  const command = useAllocationCommand(scope);
  const { reconciliation } = row;
  const blocker = blockerOf(reason, reconciliation.discrepancy_id);
  const submit = () => {
    if (blocker !== null || reconciliation.discrepancy_id === null) return;
    void command.send({
      target: { kind: "justify", reconciliationId: reconciliation.id },
      body: {
        kind: "reconcile_justify",
        command_id: crypto.randomUUID(),
        reconciliation_id: reconciliation.id,
        discrepancy_id: reconciliation.discrepancy_id,
        expected_revision: reconciliation.revision,
        reason_code: reason.reasonCode,
        reason: reason.reason.trim(),
        evidence: [],
      },
    });
  };
  return { reason, command, blocker, submit };
}
