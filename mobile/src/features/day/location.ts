import { isCoordinates, isRecord } from "./assignment-parser.ts";
export interface LocationFix {
  readonly lat: number;
  readonly lng: number;
  readonly accuracy_m: number | null;
  readonly fixedAt: number;
}
export type LocationState =
  | { readonly kind: "granted" | "stale"; readonly fix: LocationFix }
  | { readonly kind: "denied" }
  | { readonly kind: "unavailable" };
export interface LocationSource {
  start(publish: (state: LocationState) => void): Promise<() => void>;
}
/** [ASSUMPTION] Local display freshness is 60 s; it is not the upload ping interval or a business threshold. */
export const FIX_FRESHNESS_MS = 60_000;
export function currentLocation(state: LocationState, now: Date): LocationState {
  if (state.kind !== "granted") return state;
  if (!isCoordinates(state.fix.lat, state.fix.lng) || !Number.isFinite(state.fix.fixedAt))
    return { kind: "unavailable" };
  return now.getTime() - state.fix.fixedAt > FIX_FRESHNESS_MS
    ? { kind: "stale", fix: state.fix }
    : state;
}
export function maxGpsAccuracy(snapshot: unknown): number | null {
  if (!isRecord(snapshot) || !Array.isArray(snapshot.parameters)) return null;
  const parameter: unknown = snapshot.parameters.find(
    (entry: unknown) => isRecord(entry) && entry.key === "max_gps_accuracy_m",
  );
  return isRecord(parameter) && typeof parameter.value === "number" && parameter.value > 0
    ? parameter.value
    : null;
}
