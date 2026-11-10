import type { MessageKey } from "@wolbachia/i18n";
import type { Tone } from "../../ui/tone";
import type { PcrStatus } from "./pcr-api";

export const STATUS_TONE: Record<PcrStatus, Tone> = {
  preparing: "neutral",
  ready_to_ship: "info",
  shipped: "warning",
  received_by_lab: "warning",
  results_received: "info",
  closed: "success",
  voided: "critical",
};

/** The flow in order (the stepper); `voided` is shown apart. */
export const FLOW: readonly PcrStatus[] = [
  "preparing",
  "ready_to_ship",
  "shipped",
  "received_by_lab",
  "results_received",
  "closed",
];

export type NextAction = "ready" | "ship" | "receive" | "results" | "close";

/** The one primary action of each status (none once closed or voided). */
export const NEXT_ACTION: Partial<Record<PcrStatus, NextAction>> = {
  preparing: "ready",
  ready_to_ship: "ship",
  shipped: "receive",
  received_by_lab: "results",
  results_received: "close",
};

export function statusKey(status: PcrStatus): MessageKey {
  return `pcr.status.${status}` as MessageKey;
}

export function targetKey(target: string): MessageKey {
  return `pcr.target.${target}` as MessageKey;
}

export function outcomeKey(outcome: string): MessageKey {
  return `pcr.outcome.${outcome}` as MessageKey;
}

/** Wolbachia present is the goal (green); dengue present is an alert (red). */
export function outcomeTone(target: string, outcome: string): Tone {
  if (outcome === "invalid") return "warning";
  if (outcome === "positive") return target === "dengue" ? "critical" : "success";
  return target === "dengue" ? "success" : "neutral";
}
