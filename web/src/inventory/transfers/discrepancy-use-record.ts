import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVoidLimits } from "../../void/use-void-limits";
import { useOnlineStatus } from "../../shell/use-online-status";
import { useInventoryContext } from "../use-inventory-context";
import { applyDiscrepancySignature, buildDiscrepancyClose } from "./discrepancy-resolution";
import type { DiscrepancyDraft, DiscrepancyOutcomeDraft } from "./discrepancy-resolution";
import { discrepancyRecordOptions, isDiscrepancyDenied } from "./discrepancy-query";
import { useDiscrepancyCommand } from "./discrepancy-use-command";
import { transferRouteScope } from "./transfer-route-scope";

const EMPTY_DRAFT: DiscrepancyDraft = { reason: "", evidenceId: "", outcomes: {} };
function useDiscrepancyDraft() {
  const [draft, setDraft] = useState<DiscrepancyDraft>(EMPTY_DRAFT);
  const reset = useCallback(() => {
    setDraft(EMPTY_DRAFT);
  }, []);
  return {
    draft,
    reset,
    setReason: (reason: string) => {
      setDraft((old) => ({ ...old, reason }));
    },
    setEvidence: (evidenceId: string) => {
      setDraft((old) => ({ ...old, evidenceId }));
    },
    setOutcome: (id: string, outcome: DiscrepancyOutcomeDraft) => {
      setDraft((old) => ({ ...old, outcomes: { ...old.outcomes, [id]: outcome } }));
    },
    setSignature: (lineId: string, signatureId: string) => {
      setDraft((current) => applyDiscrepancySignature(current, { lineId, signatureId }));
    },
  };
}
function useDiscrepancyRead(code: string) {
  const scope = transferRouteScope(useInventoryContext(), "discrepancies", code);
  const query = useQuery(discrepancyRecordOptions(scope, code));
  const command = useDiscrepancyCommand(code);
  const record =
    query.data?.code === code && !query.isPlaceholderData && !isDiscrepancyDenied(query.error)
      ? query.data
      : null;
  const isFresh = !!record && !query.isFetching && !query.isError && scope.identity.isSettled;
  const refresh = async () => {
    const fresh = await query.refetch();
    if (fresh.isSuccess && !fresh.isPlaceholderData && fresh.data?.code === code) command.reset();
  };
  return { scope, query, command, record, isFresh, refresh };
}
function shouldRetireDraft(read: ReturnType<typeof useDiscrepancyRead>) {
  if (!read.scope.identity.isSettled) return false;
  if (!read.scope.identity.permissions?.includes("discrepancy.close")) return true;
  if (read.query.isFetching || read.query.isPlaceholderData) return false;
  return (
    isDiscrepancyDenied(read.query.error) || (read.query.isSuccess && read.query.data === null)
  );
}
/** A changed scope hides capture until its current read; only a settled denial retires it. */
function useDraftRetirement(
  read: ReturnType<typeof useDiscrepancyRead>,
  capture: ReturnType<typeof useDiscrepancyDraft>,
) {
  const resetCommand = useRef(read.command.reset);
  resetCommand.current = read.command.reset;
  const shouldRetire = shouldRetireDraft(read);
  const resetCapture = capture.reset;
  useEffect(() => {
    if (!shouldRetire) return;
    resetCapture();
    resetCommand.current();
  }, [shouldRetire, resetCapture]);
}
function canCloseWithOutcomes(
  state: ReturnType<typeof useDiscrepancyRead>,
  draft: DiscrepancyDraft,
) {
  const actions = state.scope.identity.permissions ?? [];
  if (!actions.includes("discrepancy.close")) return false;
  return Object.values(draft.outcomes).every((outcome) => {
    if (["recover_dest", "return_origin"].includes(outcome.kind))
      return actions.includes("transfer.receive");
    return outcome.kind !== "reference_signed_correction" || actions.includes("transfer.read");
  });
}
export function useDiscrepancyRecord(code: string) {
  const read = useDiscrepancyRead(code);
  const capture = useDiscrepancyDraft();
  useDraftRetirement(read, capture);
  const limits = useVoidLimits();
  const isOnline = useOnlineStatus();
  const body = read.record ? buildDiscrepancyClose(read.record, capture.draft, limits) : null;
  const canClose = read.scope.identity.permissions?.includes("discrepancy.close") === true;
  const canSubmitOutcomes = canCloseWithOutcomes(read, capture.draft);
  const isOpen = read.record !== null && read.record.status === "open";
  const isBlocked =
    !body || !read.isFresh || !isOnline || !canSubmitOutcomes || read.command.isFrozen || !isOpen;
  const submit = () =>
    body && read.record && !isBlocked
      ? read.command.send({ id: read.record.id, body })
      : Promise.resolve();
  return { ...read, ...capture, limits, isOnline, canClose, isBlocked, submit };
}
export type DiscrepancyRecordState = ReturnType<typeof useDiscrepancyRecord>;
