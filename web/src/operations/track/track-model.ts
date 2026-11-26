import type { Schemas } from "@wolbachia/api-client";

export const TRACK_PERMISSION = "courier_track.read";

const MINUTE_MS = 60_000;
// shortcut: the default of the rule `track_upload_interval_seconds` (300 s); read the value in force
// once supervisors can read `/rule-parameters/`.
const UPLOAD_INTERVAL_MS = 300_000;
/** A position is stale after two missed uploads. */
export const STALE_AFTER_MINUTES = (2 * UPLOAD_INTERVAL_MS) / MINUTE_MS;

export type LngLat = [number, number];

/** Whole minutes since the phone recorded the position, measured at `now` (epoch ms). */
export function positionAge(recordedAt: string, now: number) {
  const elapsed = Math.max(0, now - Date.parse(recordedAt));
  return {
    minutes: Math.floor(elapsed / MINUTE_MS),
    isStale: elapsed > STALE_AFTER_MINUTES * MINUTE_MS,
  };
}

/** One line per segment, so a gap between uploads is never drawn as a straight jump. */
export function trackLines(segments: readonly Schemas["TrackSegmentRead"][]): LngLat[][] {
  return segments
    .map((segment) => segment.positions.map(([, lat, lng]): LngLat => [Number(lng), Number(lat)]))
    .filter((line) => line.length > 0);
}
