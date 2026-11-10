import type { Schemas } from "@wolbachia/api-client";

/** Speed lock rules from the downloaded snapshot. The app shows them; it never decides other values. */
export interface SafetyRules {
  readonly lockKmh: number;
  readonly unlockSeconds: number;
  readonly unlockKmh: number;
  /** `null` while the snapshot carries no limit: accuracy is then not a reason to discard a fix. */
  readonly maxAccuracyM: number | null;
}

/** [ASSUMPTION] A fix older than this is stale (same bound the day screen uses for display). */
export const SAFETY_FIX_FRESH_MS = 60_000;
const MS_PER_KMH = 3.6;
const FALLBACK_UNLOCK_KMH = 3;

export interface SafetySample {
  readonly atMs: number;
  /** Metres per second as the platform reports it; `null` when the platform has no speed. */
  readonly speedMps: number | null;
  readonly accuracyM: number | null;
}

export type FixQuality = "usable" | "missing" | "stale" | "poorAccuracy" | "unknownSpeed";

export interface SafetyState {
  readonly latestFix: SafetySample | null;
  readonly speedKmh: number | null;
  readonly quality: FixQuality;
  readonly lockCause: "speed" | null;
  /** Start of the current continuous interval of fresh usable fixes below the unlock speed. */
  readonly lowSpeedSinceMs: number | null;
  readonly lastLowFixMs: number | null;
}

export const INITIAL_SAFETY: SafetyState = {
  latestFix: null,
  speedKmh: null,
  quality: "missing",
  lockCause: null,
  lowSpeedSinceMs: null,
  lastLowFixMs: null,
};

export function readSafetyRules(
  snapshot: Schemas["RulesSnapshot"] | null,
  maxAccuracyM: number | null = null,
): SafetyRules {
  const lockKmh = readRule(snapshot, { key: "speed_lock_kmh", fallback: 10, min: 5, max: 15 });
  const unlockSeconds = readRule(snapshot, {
    key: "speed_unlock_seconds",
    fallback: 5,
    min: 3,
    max: 30,
  });
  const wanted = readRule(snapshot, {
    key: "unlock_speed_kmh",
    fallback: FALLBACK_UNLOCK_KMH,
    min: 1,
    max: 14,
  });
  // The lock speed must stay above the unlock speed, or the lock could never end.
  const unlockKmh = wanted < lockKmh ? wanted : Math.min(FALLBACK_UNLOCK_KMH, lockKmh - 1);
  return { lockKmh, unlockSeconds, unlockKmh, maxAccuracyM };
}

interface RuleBounds {
  readonly key: string;
  readonly fallback: number;
  readonly min: number;
  readonly max: number;
}

function readRule(snapshot: Schemas["RulesSnapshot"] | null, bounds: RuleBounds): number {
  const value = snapshot?.parameters.find((parameter) => parameter.key === bounds.key)?.value;
  if (typeof value !== "number" || !Number.isFinite(value)) return bounds.fallback;
  return Math.max(bounds.min, Math.min(bounds.max, Math.floor(value)));
}

export function classifyFix(
  sample: SafetySample | null,
  nowMs: number,
  rules: SafetyRules,
): FixQuality {
  if (sample === null || !Number.isFinite(sample.atMs)) return "missing";
  if (nowMs - sample.atMs > SAFETY_FIX_FRESH_MS || sample.atMs > nowMs) return "stale";
  if (isPoorAccuracy(sample, rules)) return "poorAccuracy";
  return isKnownSpeed(sample.speedMps) ? "usable" : "unknownSpeed";
}

function isPoorAccuracy(sample: SafetySample, rules: SafetyRules): boolean {
  if (rules.maxAccuracyM === null) return false;
  return sample.accuracyM === null || sample.accuracyM > rules.maxAccuracyM;
}

function isKnownSpeed(speedMps: number | null): speedMps is number {
  return speedMps !== null && Number.isFinite(speedMps) && speedMps >= 0;
}

export interface SafetyObservation {
  readonly state: SafetyState;
  readonly sample: SafetySample | null;
  readonly nowMs: number;
  readonly rules: SafetyRules;
}

/**
 * One step of the lock. Locks at `lockKmh`. Unlocks only when fresh usable fixes stay below
 * `unlockKmh` continuously for `unlockSeconds`. A missing, stale, inaccurate or speedless fix resets
 * that interval: not knowing the speed never counts as being stopped, and never locks by guessing.
 */
export function observeSafety(input: SafetyObservation): SafetyState {
  const { state, sample, nowMs, rules } = input;
  const quality = classifyFix(sample, nowMs, rules);
  if (sample === null || quality !== "usable" || !isKnownSpeed(sample.speedMps))
    return {
      ...state,
      latestFix: sample ?? state.latestFix,
      speedKmh: null,
      quality,
      lowSpeedSinceMs: null,
      lastLowFixMs: null,
    };
  const speedKmh = sample.speedMps * MS_PER_KMH;
  const base = { ...state, latestFix: sample, speedKmh, quality };
  if (speedKmh >= rules.lockKmh)
    return { ...base, lockCause: "speed", lowSpeedSinceMs: null, lastLowFixMs: null };
  if (speedKmh >= rules.unlockKmh) return { ...base, lowSpeedSinceMs: null, lastLowFixMs: null };
  return trackLowSpeed(base, sample.atMs, rules);
}

function trackLowSpeed(state: SafetyState, atMs: number, rules: SafetyRules): SafetyState {
  const previous = state.lowSpeedSinceMs;
  const isContinuous =
    previous !== null &&
    state.lastLowFixMs !== null &&
    atMs - state.lastLowFixMs <= SAFETY_FIX_FRESH_MS;
  const since = isContinuous ? previous : atMs;
  const isReleased = state.lockCause !== null && atMs - since >= rules.unlockSeconds * 1000;
  return {
    ...state,
    lockCause: isReleased ? null : state.lockCause,
    lowSpeedSinceMs: isReleased ? null : since,
    lastLowFixMs: atMs,
  };
}
