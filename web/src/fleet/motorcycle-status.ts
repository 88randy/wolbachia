import type { MessageKey } from "@wolbachia/i18n";
import type { Motorcycle } from "./fleet-query";
const REASONS: Record<Motorcycle["blocked_reason"], MessageKey> = {
  "": "fleet.reason.unknown",
  severe_check: "fleet.reason.severeCheck",
  service_overdue: "fleet.reason.serviceOverdue",
  out_of_service: "fleet.reason.outOfService",
};
/** Translate backend codes without inferring operational readiness. */
export function blockedReasonKey(motorcycle: Motorcycle): MessageKey {
  return REASONS[motorcycle.blocked_reason];
}
export function motorcycleStatus(motorcycle: Motorcycle) {
  if (motorcycle.voided_at !== null) return "voided";
  return motorcycle.is_blocked ? "blocked" : "available";
}
