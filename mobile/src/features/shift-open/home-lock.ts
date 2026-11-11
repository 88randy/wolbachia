import type { MessageKey } from "@wolbachia/i18n";
import type { Gate } from "./domain.ts";
import type { ShiftSnapshot } from "./service.ts";

/** Why the capture tiles of Mi día are off, derived from the local shift only. */
export type HomeLock =
  | { readonly kind: "none" }
  | { readonly kind: "noShift" }
  | { readonly kind: "blocked"; readonly gate: Gate };

export function homeLock(state: ShiftSnapshot | null): HomeLock {
  if (state?.opening == null || state.opening.status === "rejected") return { kind: "noShift" };
  return state.gate === null ? { kind: "none" } : { kind: "blocked", gate: state.gate };
}

/** One plain sentence with the real single reason, or null when nothing is locked. */
export function lockReasonKey(lock: HomeLock): MessageKey | null {
  if (lock.kind === "none") return null;
  if (lock.kind === "noShift") return "courier.home.needsShift";
  if (lock.gate === "severe") return "courier.home.lockSevere";
  return `field.open.gate.${lock.gate}`;
}
