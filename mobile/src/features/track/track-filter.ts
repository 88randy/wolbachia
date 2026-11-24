import { metersBetween } from "./simplify-track.ts";
import type { TrackFix } from "./simplify-track.ts";
import type { TrackRules } from "./track-rules.ts";

/** [ASSUMPTION] Technical floor, not a business rule: coarser fixes (cell only) only add noise. */
export const MAX_TRACK_ACCURACY_M = 100;

/** A fix as the native task delivers it; accuracy may be unknown. */
export interface RawFix {
  readonly at: number;
  readonly lat: number;
  readonly lng: number;
  readonly accuracyM: number | null;
}

/**
 * Keeps a fix only when it is precise (accuracy <= 100 m) and either moved at least
 * max(track_min_move_m, its accuracy) from the last kept fix, or the stillness heartbeat
 * elapsed since it. A still phone therefore keeps one fix per heartbeat, not one per sample.
 */
export function keepFix(
  last: TrackFix | null,
  fix: RawFix,
  rules: Pick<TrackRules, "minMoveM" | "stillHeartbeatSeconds">,
): fix is TrackFix {
  const { accuracyM } = fix;
  if (accuracyM === null || !(accuracyM >= 0 && accuracyM <= MAX_TRACK_ACCURACY_M)) return false;
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lng) || !Number.isFinite(fix.at))
    return false;
  if (last === null) return true;
  if (fix.at <= last.at) return false;
  if (fix.at - last.at >= rules.stillHeartbeatSeconds * 1000) return true;
  return metersBetween(last, { ...fix, accuracyM }) >= Math.max(rules.minMoveM, accuracyM);
}
