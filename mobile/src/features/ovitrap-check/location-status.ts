import type { LocationState } from "../day/location.ts";

/** What the courier sees about the location while capturing. Never a rule, only the state. */
export type LocationStatus =
  | { readonly kind: "ready"; readonly accuracyM: number | null }
  | { readonly kind: "searching"; readonly accuracyM: number | null }
  | { readonly kind: "missing" };

/** Technical wait before saying the capture goes without an exact location. */
export const LOCATION_WAIT_MS = 10_000;

export function locationStatus(state: LocationState, hasWaitedLong: boolean): LocationStatus {
  if (state.kind === "granted") return { kind: "ready", accuracyM: state.fix.accuracy_m };
  if (state.kind === "denied" || state.kind === "off") return { kind: "missing" };
  if (hasWaitedLong) return { kind: "missing" };
  return { kind: "searching", accuracyM: state.kind === "stale" ? state.fix.accuracy_m : null };
}
