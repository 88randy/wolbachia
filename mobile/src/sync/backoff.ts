/**
 * How long to wait before the next sync attempt after consecutive failures.
 * Technical retry timing, not a business rule: the values are [ASSUMPTION] until the field test (#13).
 */
export const BACKOFF = {
  baseMs: 2_000,
  factor: 2,
  maxMs: 300_000,
  /** A server `Retry-After` shorter than this is rounded up so a tight loop cannot form. */
  minRetryAfterMs: 1_000,
} as const;

const MS_PER_SECOND = 1_000;

/**
 * Exponential backoff with "equal jitter": half of the ceiling is fixed and half is random, so
 * phones that failed together do not all come back at the same instant, and the wait never
 * collapses to zero. `random` is injected (a number in [0, 1)) so the result is deterministic in tests.
 *
 * @param consecutiveFailures 1 for the first failure in a row.
 */
export function backoffDelayMs(consecutiveFailures: number, random: number): number {
  const exponent = Math.max(consecutiveFailures, 1) - 1;
  const ceiling = Math.min(BACKOFF.maxMs, BACKOFF.baseMs * BACKOFF.factor ** exponent);
  const half = ceiling / 2;
  return Math.round(half + random * half);
}

/** The delay a server `Retry-After` (in seconds) asks for, kept between the minimum and the maximum. */
export function retryAfterDelayMs(retryAfterSeconds: number): number {
  const requested = retryAfterSeconds * MS_PER_SECOND;
  return Math.min(BACKOFF.maxMs, Math.max(BACKOFF.minRetryAfterMs, requested));
}
