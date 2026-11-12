import type { Draft } from "./types.ts";
type ReviewCapture = Pick<Draft, "point" | "gps" | "rules" | "mode">;
/** Metres use the same mean-earth-radius Haversine approximation as B-14. */
function distance(draft: ReviewCapture): number | null {
  if (!draft.point || !draft.gps) return null;
  const radians = Math.PI / 180;
  const lat = draft.gps.lat * radians;
  const pointLat = draft.point.lat * radians;
  const halfLat = Math.sin((pointLat - lat) / 2);
  const halfLng = Math.sin(((draft.point.lng - draft.gps.lng) * radians) / 2);
  return (
    6371008.8 *
    2 *
    Math.asin(
      Math.min(1, Math.sqrt(halfLat ** 2 + Math.cos(lat) * Math.cos(pointLat) * halfLng ** 2)),
    )
  );
}
function isGpsUsable(draft: ReviewCapture): boolean {
  const accuracy = draft.gps?.accuracy_m;
  if (!draft.gps || typeof accuracy !== "number" || !Number.isFinite(accuracy)) return false;
  return accuracy > 0 && accuracy <= (draft.rules?.maxAccuracyM ?? 50);
}
function isStale(draft: ReviewCapture, now: Date): boolean {
  if (!draft.rules) return true;
  return draft.rules.nextChangeAt !== null && Date.parse(draft.rules.nextChangeAt) <= now.getTime();
}
export function reviewReasons(draft: ReviewCapture, now: Date): readonly string[] {
  const reasons: string[] = [];
  if (!isGpsUsable(draft)) reasons.push("gps");
  if (isStale(draft, now)) reasons.push("stale");
  const metres = distance(draft);
  // A far verdict needs the whole accuracy circle to be outside the allowed distance.
  const slack = draft.gps?.accuracy_m ?? 0;
  if (metres !== null && metres - slack > (draft.rules?.maxDistanceM ?? 50))
    reasons.push("distance");
  if (draft.mode === "check" && draft.point === null) reasons.push("location");
  return reasons;
}
