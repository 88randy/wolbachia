import type { Schemas } from "@wolbachia/api-client";
import { readRule } from "../../auth/auth-rules.ts";

/** The seven `track_*` rule parameters (backend/rules/seeds.py): defaults and bounds of the seed. */
export interface TrackRules {
  readonly sampleIntervalSeconds: number;
  readonly minMoveM: number;
  readonly stillHeartbeatSeconds: number;
  readonly uploadIntervalSeconds: number;
  readonly simplifyToleranceM: number;
  readonly isHighAccuracy: boolean;
  /** Local end of the work day, in minutes after midnight in the organization's time zone. */
  readonly dayEndMinutes: number;
}

export function readTrackRules(snapshot: Schemas["RulesSnapshot"] | null): TrackRules {
  const parameters = snapshot?.parameters ?? [];
  const rule = (key: string, [fallback, min, max]: readonly [number, number, number]) =>
    readRule(parameters, { key, fallback, min, max });
  return {
    sampleIntervalSeconds: rule("track_sample_interval_seconds", [15, 5, 300]),
    minMoveM: rule("track_min_move_m", [15, 1, 200]),
    stillHeartbeatSeconds: rule("track_still_heartbeat_seconds", [300, 60, 3600]),
    uploadIntervalSeconds: rule("track_upload_interval_seconds", [300, 60, 3600]),
    simplifyToleranceM: rule("track_simplify_tolerance_m", [5, 0, 50]),
    isHighAccuracy: rule("track_high_accuracy", [0, 0, 1]) === 1,
    dayEndMinutes: rule("track_day_end_minutes", [1200, 600, 1439]),
  };
}
