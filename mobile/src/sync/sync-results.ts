import type { Schemas } from "@wolbachia/api-client";

import type { OutboxEvent } from "../outbox/outbox-event.ts";
import type { OutboxTransition } from "../outbox/outbox-repository.ts";
import type { PassOutcome } from "./sync-pass.ts";
import type { SyncResponse } from "./sync-transport.ts";

const MS_PER_SECOND = 1_000;
// [ASSUMPTION] Malformed/missing quota delay falls back to one day; never retry in a tight loop.
const DEFAULT_QUOTA_WAIT_SECONDS = 86_400;

/** Quota-limited rejections were NOT stored: keep the immutable evidence and defer its resend. */
export function quotaTransition(result: Schemas["EventResult"], now: Date): OutboxTransition {
  const requested = result.params.retry_after_seconds;
  const seconds =
    typeof requested === "number" && Number.isFinite(requested) && requested > 0
      ? requested
      : DEFAULT_QUOTA_WAIT_SECONDS;
  return {
    id: result.id,
    action: "release",
    lastError: result.code,
    retryAt: new Date(now.getTime() + seconds * MS_PER_SECOND).toISOString(),
  };
}

export function quotaWaitOutcome(delayMs: number): PassOutcome {
  return { kind: "retry", delayMs, countsAsFailure: false, code: "rejection_quota_exceeded" };
}

/** Missing results count as a failed attempt and stop this pass, preventing an immediate resend loop. */
export function missingResultOutcome(
  batch: readonly OutboxEvent[],
  response: SyncResponse,
): PassOutcome | null {
  const answered = new Set(response.results.map((result) => result.id));
  return batch.some((event) => !answered.has(event.envelope.id))
    ? { kind: "retry", delayMs: null, countsAsFailure: true, code: "missing_event_result" }
    : null;
}
