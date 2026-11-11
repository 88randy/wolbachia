import { useEffect, useRef, useState } from "react";
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
import { useSignatureMode } from "./use-signature-mode";

type Assignment = Schemas["SupplyAssignmentRead"];
export type DeliveryStatus = "planned" | "released" | "cancelled" | "received";

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

/** The state of a saved delivery as the server reports it; an older server means "planned". */
export function statusOf(saved: Assignment | null): DeliveryStatus | null {
  if (saved === null) return null;
  return saved.lifecycle?.status ?? "planned";
}

/** Saved lines become the draft once, when the lots (their names) are known. */
function useHydration(
  saved: Assignment | null,
  lots: readonly Schemas["Lot"][] | undefined,
  draft: ReturnType<typeof useAssignmentDraft>,
) {
  const done = useRef("");
  useEffect(() => {
    if (!saved || !lots) return;
    const key = `${saved.id}:${String(saved.revision)}`;
    if (done.current === key) return;
    done.current = key;
    draft.hydrate(
      saved,
      saved.lines.map((line) => ({
        key: line.id,
        lotId: line.lot_id,
        lotCode: lots.find((lot) => lot.id === line.lot_id)?.code ?? "",
        supplyVersionId: line.unit_version_id,
        quantity: line.quantity.replace(/\.?0+$/, ""),
      })),
    );
  }, [saved, lots, draft]);
}

export function useAssignmentPanel(scope: AllocationScope, courierId: string, date: string) {
  const suggestion = useQuery(suggestionOptions(scope, date, courierId));
  const assignment = useQuery(assignmentOptions(scope, date, courierId));
  const lots = useQuery(lotDirectoryOptions(scope, ASSIGNMENTS_ROUTE));
  const origins = useQuery(originOptions(scope, ASSIGNMENTS_ROUTE));
  const saved = assignment.data ?? null;
  const status = statusOf(saved);
  const frame = useQuery(assignmentFrameOptions(scope, saved?.id ?? ""));
  const draft = useAssignmentDraft(scope, { courierId, date });
  const command = useAllocationCommand(scope);
  const [signature, setSignature] = useState<Blob | null>(null);
  useHydration(saved, lots.data, draft);
  const isEditable = status === null || status === "planned" || status === "cancelled";
  const save = () => {
    const next = saved ? draft.revision(saved) : draft.draft();
    if (next) void command.send(next);
  };
  const mode = useSignatureMode();
  /** `withSignature` false leaves the delivery waiting for the courier's phone. */
  const release = (withSignature = true) => {
    if (!saved) return;
    const clientId = crypto.randomUUID();
    void command.send({
      target: { kind: "release", assignmentId: saved.id },
      body: {
        kind: "assignment_release",
        command_id: crypto.randomUUID(),
        assignment_id: saved.id,
        expected_revision: saved.revision,
        evidence:
          withSignature && signature ? [{ role: "signature" as const, upload_id: clientId }] : [],
      },
      ...(withSignature && signature
        ? {
            attachment: {
              file: new File([signature], "signature.png", { type: "image/png" }),
              clientId,
            },
          }
        : {}),
    });
  };
  return {
    ...{ suggestion, lots, origins, saved, frame, draft, command, status, isEditable, mode },
    ...{
      create: save,
      release,
      signature: signatureOf(saved, command.result, frame.data),
      signatureBlob: signature,
      setSignatureBlob: setSignature,
    },
  };
}
export type AssignmentPanelState = ReturnType<typeof useAssignmentPanel>;
