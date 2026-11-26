import type { LocationState } from "../day/location.ts";

/** What the courier sees about the location while capturing. Never a rule, only the state. */
export type LocationStatus =
  | { readonly kind: "ready"; readonly accuracyM: number | null }
  | { readonly kind: "searching"; readonly accuracyM: number | null }
  | { readonly kind: "missing" };

/** The wait itself lives in the location source (`noFix`), so the whole app tells one story. */
export function locationStatus(state: LocationState): LocationStatus {
  if (state.kind === "granted") return { kind: "ready", accuracyM: state.fix.accuracy_m };
  if (state.kind === "denied" || state.kind === "off" || state.kind === "noFix")
    return { kind: "missing" };
  return { kind: "searching", accuracyM: state.kind === "stale" ? state.fix.accuracy_m : null };
}

/**
 * A draft finished late (its shift closed, nothing open now) keeps the position it was made with:
 * the live stream says nothing about where the trap was, so never wait for it.
 */
export function storedLocationStatus(
  gps: { readonly accuracy_m?: number | null } | null,
): LocationStatus {
  return gps === null ? { kind: "missing" } : { kind: "ready", accuracyM: gps.accuracy_m ?? null };
}
