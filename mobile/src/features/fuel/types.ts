import type { Schemas } from "@wolbachia/api-client";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
import type { Evidence } from "../ovitrap-check/types.ts";

export interface FuelDraft {
  readonly eventId: string;
  readonly ownerKey: string;
  readonly shiftId: string;
  readonly motorcycleCode: string;
  readonly deviceTime: string;
  readonly catalogVersion: string;
  readonly rulesVersion: string;
  readonly litres: string;
  readonly amount: string;
  readonly currency: string;
  readonly odometer: string;
  readonly isFullRefill: boolean;
  readonly receipt: Evidence | null;
}
export type FuelErrorCode =
  | "litres_invalid"
  | "amount_invalid"
  | "currency_invalid"
  | "odometer_invalid"
  | "context_unavailable"
  | "scope"
  | "shift"
  | "stale_draft";
export type FuelField = "litres" | "amount" | "currency" | "odometer";
export interface FuelValues {
  readonly litres: string;
  readonly amount: string;
  readonly currency: string;
  readonly odometer_km: number;
  readonly is_full_refill: boolean;
}
export interface FuelCurrent {
  readonly deviceTime: string;
  readonly odometer: number;
  readonly litres: string;
  readonly isFullRefill: boolean;
}
/** Caller must prove this is the immediately previous load, without unknown intervening history. */
export interface FuelBaseline {
  readonly deviceTime: string;
  readonly odometer: number;
  readonly isFullRefill: boolean;
  readonly isAccepted: boolean;
}
export interface FuelEfficiencyRules {
  readonly minimum: number | null;
  readonly maximum: number | null;
}
export interface FuelAdvisory {
  readonly kind: "insufficient" | "unconfigured" | "decreased" | "ok" | "review";
  readonly efficiencyKmL: number | null;
  readonly minimum: number | null;
  readonly maximum: number | null;
}
export interface FuelState {
  readonly ready: boolean;
  readonly canBegin: boolean;
  readonly draft: FuelDraft | null;
  readonly drafts: readonly FuelDraft[];
  readonly event: OutboxEvent | null;
  readonly receiptPending: boolean;
  readonly review: Schemas["ReviewHistoryEntry"] | null;
  readonly advisory: FuelAdvisory;
}
