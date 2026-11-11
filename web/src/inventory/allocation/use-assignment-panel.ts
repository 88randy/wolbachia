import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import {
  ASSIGNMENTS_ROUTE,
  assignmentFrameOptions,
  assignmentOptions,
  lotDirectoryOptions,
  originOptions,
  suggestionOptions,
} from "./allocation-query";
import type { AllocationScope, Reconciliation } from "./allocation-query";
import type { IntentResult } from "./allocation-intent";
import { signatureState } from "./reconciliation-equation";
import { useAllocationCommand } from "./use-allocation-command";
import { useAssignmentDraft } from "./use-assignment-draft";

type Assignment = Schemas["SupplyAssignmentRead"];

/** Only real state: unassigned, sent in this session, or the signed-receipt credit of the frame. */
function signatureOf(
  saved: Assignment | null,
  result: IntentResult | undefined,
  frame: Reconciliation | null | undefined,
) {
  if (saved === null) return "unassigned" as const;
  if (frame?.frame) return signatureState(frame.frame.lines);
  return result?.kind === "release" ? ("sent" as const) : ("unknown" as const);
}

export function useAssignmentPanel(scope: AllocationScope, courierId: string, date: string) {
  const suggestion = useQuery(suggestionOptions(scope, date, courierId));
  const assignment = useQuery(assignmentOptions(scope, date, courierId));
  const lots = useQuery(lotDirectoryOptions(scope, ASSIGNMENTS_ROUTE));
  const origins = useQuery(originOptions(scope, ASSIGNMENTS_ROUTE));
  const saved = assignment.data ?? null;
  const frame = useQuery(assignmentFrameOptions(scope, saved?.id ?? ""));
  const draft = useAssignmentDraft(scope, { courierId, date });
  const command = useAllocationCommand(scope);
  const [signature, setSignature] = useState<Blob | null>(null);
  const create = () => {
    const next = draft.draft();
    if (next) void command.send(next);
  };
  const release = () => {
    if (!saved) return;
    const clientId = crypto.randomUUID();
    void command.send({
      target: { kind: "release", assignmentId: saved.id },
      body: {
        kind: "assignment_release",
        command_id: crypto.randomUUID(),
        assignment_id: saved.id,
        expected_revision: saved.revision,
        evidence: signature ? [{ role: "signature" as const, upload_id: clientId }] : [],
      },
      ...(signature
        ? {
            attachment: {
              file: new File([signature], "signature.png", { type: "image/png" }),
              clientId,
            },
          }
        : {}),
    });
  };
  const signatureState = signatureOf(saved, command.result, frame.data);
  return {
    ...{ suggestion, lots, origins, saved, frame, draft, command },
    ...{
      create,
      release,
      signature: signatureState,
      signatureBlob: signature,
      setSignatureBlob: setSignature,
    },
  };
}
export type AssignmentPanelState = ReturnType<typeof useAssignmentPanel>;
