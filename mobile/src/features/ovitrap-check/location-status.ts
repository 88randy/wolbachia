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
