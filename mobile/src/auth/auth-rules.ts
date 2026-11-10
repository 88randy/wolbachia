import type { Schemas } from "@wolbachia/api-client";

export interface AuthRules {
  readonly pinMaxAttempts: number;
  readonly sessionIdleMinutes: number;
  readonly clockSkewReviewSeconds: number;
  /** Time the app may stay in the background (camera, dialogs) before it asks for the PIN. */
  readonly backgroundLockGraceSeconds: number;
}

/** Only this issue's three rules; no catalog synchronization. */
export function readAuthRules(snapshot: Schemas["RulesSnapshot"] | null): AuthRules {
  const parameters = snapshot?.parameters ?? [];
  return {
    pinMaxAttempts: readRule(parameters, { key: "pin_max_attempts", fallback: 3, min: 1, max: 10 }),
    sessionIdleMinutes: readRule(parameters, {
      key: "session_idle_minutes",
      fallback: 5,
      min: 1,
      max: 30,
    }),
    clockSkewReviewSeconds: readRule(parameters, {
      key: "clock_skew_review_seconds",
      fallback: 300,
      min: 30,
      max: 3600,
    }),
    backgroundLockGraceSeconds: readRule(parameters, {
      key: "background_lock_grace_seconds",
      fallback: 120,
      min: 10,
      max: 900,
    }),
  };
}

function readRule(
  parameters: Schemas["SnapshotParameter"][],
  rule: { key: string; fallback: number; min: number; max: number },
): number {
  const value = parameters.find((parameter) => parameter.key === rule.key)?.value;
  if (typeof value !== "number" || !Number.isFinite(value)) return rule.fallback;
  return Math.max(rule.min, Math.min(rule.max, Math.floor(value)));
}

export function hasClockSkew(
  serverTime: string,
  phoneTimeMs: number,
  thresholdSeconds: number,
): boolean {
  return Math.abs(Date.parse(serverTime) - phoneTimeMs) > thresholdSeconds * 1000;
}
