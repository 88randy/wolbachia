import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MessageKey } from "@wolbachia/i18n";
import { reportSessionError } from "../../session/session-events";
import { quantityUnits } from "../transfers/transfer-quantities";
import { findLot } from "./allocation-query";
import type { AllocationScope } from "./allocation-query";
import type { IntentDraft, ReviseDraft } from "./allocation-intent";
import type { DeliveredLine } from "./delivery-compare";

export type ScanState = "idle" | "loading" | "notFound" | "duplicate" | "piece" | "failed";
interface Context {
  courierId: string;
  date: string;
}

/** What one scanned code does to the draft: a new line, or the reason it was refused. */
async function scanOutcome(
  scope: AllocationScope,
  request: { code: string; lines: readonly DeliveredLine[] },
  signal: AbortSignal,
): Promise<{ state: ScanState; line?: DeliveredLine }> {
  const lot = await findLot(scope, request.code, signal);
  if (!lot) return { state: "notFound" };
  if (lot.supply_version.identity_kind === "piece") return { state: "piece" };
  if (request.lines.some((line) => line.lotId === lot.id)) return { state: "duplicate" };
  const line = {
    key: crypto.randomUUID(),
    lotId: lot.id,
    lotCode: lot.code,
    supplyVersionId: lot.supply_version_id,
    quantity: "",
  };
  return { state: "idle", line };
}

function assignmentBlockers(originId: string, lines: readonly DeliveredLine[]): MessageKey[] {
  const hasBadQuantity = lines.some((line) => (quantityUnits(line.quantity) ?? 0n) === 0n);
  return [
    ...(originId === "" ? (["allocation.assignment.blockerOrigin"] as const) : []),
    ...(lines.length === 0 ? (["allocation.assignment.blockerLines"] as const) : []),
    ...(hasBadQuantity ? (["allocation.assignment.blockerQuantity"] as const) : []),
  ];
}

function assignDraft(context: Context, originId: string, lines: readonly DeliveredLine[]) {
  const draft: IntentDraft = {
    target: { kind: "assign" },
    body: {
      command_id: crypto.randomUUID(),
      courier_id: context.courierId,
      origin_id: originId,
      date: context.date,
      lines: lines.map((line) => ({
        id: line.key,
        lot_id: line.lotId,
        piece_id: null,
        unit_version_id: line.supplyVersionId,
        quantity: line.quantity,
      })),
    },
  };
  return draft;
}

function reviseDraftOf(
  saved: { id: string; revision: number },
  lines: readonly DeliveredLine[],
): ReviseDraft {
  return {
    target: { kind: "revise", assignmentId: saved.id },
    body: {
      command_id: crypto.randomUUID(),
      expected_revision: saved.revision,
      lines: lines.map((line) => ({
        id: line.key,
        lot_id: line.lotId,
        piece_id: null,
        unit_version_id: line.supplyVersionId,
        quantity: line.quantity,
      })),
    },
  };
}

function useScan(
  scope: AllocationScope,
  lines: readonly DeliveredLine[],
  setLines: Dispatch<SetStateAction<DeliveredLine[]>>,
) {
  const cache = useQueryClient();
  const [scan, setScan] = useState<ScanState>("idle");
  async function addLot(code: string) {
    const guard = scope.beginWrite();
    if (guard.isStale() || code.trim() === "") return;
    setScan("loading");
    try {
      const outcome = await scanOutcome(scope, { code: code.trim(), lines }, guard.signal);
      if (guard.isStale() || !scope.isCurrentRead()) return;
      setScan(outcome.state);
      const line = outcome.line;
      if (line) setLines((current) => [...current, line]);
    } catch (error) {
      if (guard.isStale() || !scope.isCurrentRead()) return;
      setScan("failed");
      reportSessionError(error, cache);
    }
  }
  return { scan, addLot };
}

/** Delivery scans resolve a human lot code in the scoped collection and add one line per lot. */
export function useAssignmentDraft(scope: AllocationScope, context: Context) {
  const [lines, setLines] = useState<DeliveredLine[]>([]);
  const [originId, setOriginId] = useState("");
  const { scan, addLot } = useScan(scope, lines, setLines);
  const blockers = assignmentBlockers(originId, lines);
  const setQuantity = (key: string, quantity: string) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, quantity } : line)));
  };
  const removeLine = (key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  };
  /** Start editing a saved plan: its lines and origin become the draft. */
  const hydrate = (saved: { origin_id: string }, next: DeliveredLine[]) => {
    setOriginId(saved.origin_id);
    setLines(next);
  };
  return {
    ...{ lines, originId, scan, blockers, addLot, setOriginId, setQuantity, removeLine, hydrate },
    draft: () => (blockers.length > 0 ? null : assignDraft(context, originId, lines)),
    revision: (saved: { id: string; revision: number }) =>
      blockers.length > 0 ? null : reviseDraftOf(saved, lines),
  };
}
export type AssignmentDraft = ReturnType<typeof useAssignmentDraft>;
