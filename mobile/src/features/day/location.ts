import { isCoordinates, isRecord } from "./assignment-parser.ts";
export interface LocationFix {
  readonly lat: number;
  readonly lng: number;
  readonly accuracy_m: number | null;
  readonly fixedAt: number;
  /** Platform speed in m/s for the speed lock; absent when the source cannot report it. */
  readonly speed_mps?: number | null;
}
export type LocationState =
  | { readonly kind: "granted" | "stale"; readonly fix: LocationFix }
  | { readonly kind: "denied" }
  /** Phone location services are switched off. */
  | { readonly kind: "off" }
  /** Services and permission are fine; there is no fix yet (or it timed out). Calm, keeps trying. */
  | { readonly kind: "searching" }
  /** Services and permission are fine but no fix arrived within the wait; the capture goes without exact location. */
  | { readonly kind: "noFix" }
  /** Not needed now (no open shift) or unknown. */
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
