import type { Me } from "../session/me";

export interface VoidLimits {
  minLength: number;
  maxLength: number;
}

/**
 * Used only where there is no session (tests, the dev harness). The real values come from
 * `GET /me/` (`limits`), which is the server's `VOID_REASON_MIN_LENGTH` setting; the form never
 * decides them, and the server's `void_reason_too_short` answer still wins.
 */
export const DEFAULT_VOID_LIMITS: VoidLimits = { minLength: 10, maxLength: 1000 };

export function voidLimitsOf(me: Me): VoidLimits {
  return {
    minLength: me.limits.void_reason_min_length,
    maxLength: me.limits.void_reason_max_length,
  };
}
