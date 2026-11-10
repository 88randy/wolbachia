import { quantityText, quantityUnits } from "../transfers/transfer-quantities";
import type { Suggestion } from "./allocation-query";

export interface DeliveredLine {
  key: string;
  lotId: string;
  lotCode: string;
  supplyVersionId: string;
  quantity: string;
}
export type DeliveryState = "complete" | "short" | "over" | "unsuggested" | "invalid";
export interface DeliveryRow {
  supplyVersionId: string;
  suggested: string | null;
  delivered: string;
  state: DeliveryState;
  /** Absolute shortfall or excess as exact decimal text. */
  gap: string;
}

function suggestedTotals(suggestion: Suggestion | undefined) {
  const totals = new Map<string, bigint>();
  if (suggestion?.status !== "assessed") return totals;
  for (const line of suggestion.lines)
    totals.set(
      line.supply_version_id,
      (totals.get(line.supply_version_id) ?? 0n) + (quantityUnits(line.quantity) ?? 0n),
    );
  return totals;
}

/** A null total marks a material with at least one unreadable quantity. */
function deliveredTotals(lines: readonly DeliveredLine[]) {
  const totals = new Map<string, bigint | null>();
  for (const line of lines) {
    const units = quantityUnits(line.quantity);
    const previous = totals.get(line.supplyVersionId);
    totals.set(
      line.supplyVersionId,
      units === null || previous === null ? null : (previous ?? 0n) + units,
    );
  }
  return totals;
}

function stateOf(want: bigint | undefined, have: bigint): DeliveryState {
  if (want === undefined) return "unsuggested";
  if (have === want) return "complete";
  return have < want ? "short" : "over";
}

function rowOf(id: string, want: bigint | undefined, have: bigint | null): DeliveryRow {
  const suggested = want === undefined ? null : quantityText(want);
  if (have === null)
    return { supplyVersionId: id, suggested, delivered: "", state: "invalid", gap: "0" };
  const diff = have - (want ?? 0n);
  return {
    supplyVersionId: id,
    suggested,
    delivered: quantityText(have),
    state: stateOf(want, have),
    gap: quantityText(diff < 0n ? -diff : diff),
  };
}

/** Exact decimal comparison of what the schedule suggests and what was scanned and delivered. */
export function compareDelivery(
  suggestion: Suggestion | undefined,
  lines: readonly DeliveredLine[],
): DeliveryRow[] {
  const suggested = suggestedTotals(suggestion);
  const delivered = deliveredTotals(lines);
  const ids = new Set([...suggested.keys(), ...delivered.keys()]);
  return [...ids].map((id) =>
    rowOf(id, suggested.get(id), delivered.has(id) ? (delivered.get(id) ?? null) : 0n),
  );
}
