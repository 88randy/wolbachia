import type { Schemas } from "@wolbachia/api-client";
import { quantityUnits } from "../transfers/transfer-quantities";
import type { Reconciliation } from "./allocation-query";

export type FrameLine = Schemas["SupplyFrameLine"];
/** `pending` is a missing signed receipt or result, never a zero. */
export type LineState = "pending" | "balanced" | "difference";
export interface ReconciliationRow {
  key: string;
  reconciliation: Reconciliation;
  line: FrameLine;
  state: LineState;
}

/** The backend owns the arithmetic (credited - used - returned - shrinkage); this only classifies it. */
export function lineState(line: FrameLine): LineState {
  if (line.credited === null || line.difference === null) return "pending";
  const units = quantityUnits(line.difference.replace(/^-/, ""));
  return units === null || units === 0n ? "balanced" : "difference";
}

export function reconciliationRows(items: readonly Reconciliation[]): ReconciliationRow[] {
  return items.flatMap((reconciliation) =>
    (reconciliation.frame?.lines ?? []).map((line) => ({
      key: `${reconciliation.id}:${line.assignment_line_id}`,
      reconciliation,
      line,
      state: lineState(line),
    })),
  );
}

/** Signature state is read from the signed receipt credit: no credit means the phone has not signed. */
export function signatureState(rows: readonly Pick<FrameLine, "credited">[]) {
  if (rows.length === 0) return "unknown" as const;
  return rows.every((line) => line.credited !== null)
    ? ("verified" as const)
    : ("pending" as const);
}

export function differenceSign(difference: string): "negative" | "positive" | "zero" {
  const units = quantityUnits(difference.replace(/^-/, ""));
  if (units === null || units === 0n) return "zero";
  return difference.startsWith("-") ? "negative" : "positive";
}
