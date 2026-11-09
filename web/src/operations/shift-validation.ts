import type { MessageKey } from "@wolbachia/i18n";
import type { Schemas } from "@wolbachia/api-client";
import type { VoidLimits } from "../void/void-limits";
import { countCharacters, hasForbiddenCharacters, normalizeReason } from "../void/count-characters";
export type ShiftDetail = Schemas["ShiftDetail"];
export type DecisionKind = Schemas["ShiftValidationKindEnum"];

/** Mirrors the existing reason validator; the server remains authoritative. */
export function reasonError(reason: string, limits: VoidLimits): MessageKey | undefined {
  const normalized = normalizeReason(reason);
  if (hasForbiddenCharacters(normalized)) return "shift.error.invalidCharacters";
  if (countCharacters(normalized) < limits.minLength) return "shift.error.tooShort";
  if (Array.from(normalized).length > limits.maxLength) return "shift.error.tooLong";
  return undefined;
}
/** A decision is distinct from the immutable open/closed lifecycle. */
export function validationState(shift: ShiftDetail) {
  if (shift.status === "open") return "open";
  if (shift.validation.kind === "observe") return "observed";
  if (shift.validation.kind === "approve")
    return shift.validation.approval_current ? "approved" : "outdated";
  return "pending";
}
export function canDecide(shift: ShiftDetail, kind: DecisionKind): boolean {
  return shift.status === "closed" && (kind === "observe" || shift.validation.blockers.length === 0);
}
const BLOCKER_KEYS: Readonly<Record<string, MessageKey>> = {
  shift_not_closed: "shift.blocker.open",
  shift_source_not_effective: "shift.blocker.source",
  unresolved_shift_review: "shift.blocker.review",
  motorcycle_safety_hold: "shift.blocker.motorcycle",
  incident_safety_hold: "shift.blocker.incident",
  shift_scope_unavailable: "shift.blocker.scope",
};
export function blockerKey(code: string): MessageKey {
  return BLOCKER_KEYS[code] ?? "shift.blocker.unknown";
}
