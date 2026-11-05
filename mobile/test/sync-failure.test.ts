import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BACKOFF, backoffDelayMs, retryAfterDelayMs } from "../src/sync/backoff.ts";
import { planFailure } from "../src/sync/sync-failure.ts";
import type { PlanContext, SyncFailure } from "../src/sync/sync-failure.ts";

const CONTEXT: PlanContext = { batchSize: 50, cursorAlreadyReset: false };

function http(
  status: number,
  code: string,
  extra: { fieldCodes?: Record<string, readonly string[]>; retryAfterSeconds?: number } = {},
): SyncFailure {
  return {
    kind: "http",
    status,
    code,
    fieldCodes: extra.fieldCodes ?? {},
    retryAfterSeconds: extra.retryAfterSeconds ?? null,
  };
}

void describe("what to do after a failed sync request (docs/sync.md, batch errors)", () => {
  void it("retries later when there is no answer or the server fails", () => {
    assert.deepEqual(planFailure({ kind: "network" }, CONTEXT), {
      action: "retry",
      retryAfterMs: null,
    });
    assert.deepEqual(planFailure(http(502, "unknown_error"), CONTEXT), {
      action: "retry",
      retryAfterMs: null,
    });
  });

  void it("stops until sign-in for every authentication code and for any 401", () => {
    for (const code of [
      "not_authenticated",
      "invalid_token",
      "token_expired",
      "session_revoked",
      "device_mismatch",
    ]) {
      assert.deepEqual(
        planFailure(http(401, code), CONTEXT),
        { action: "block", reason: "needsLogin" },
        code,
      );
    }
    assert.deepEqual(planFailure(http(403, "device_mismatch"), CONTEXT), {
      action: "block",
      reason: "needsLogin",
    });
    assert.deepEqual(planFailure(http(401, "unknown_error"), CONTEXT), {
      action: "block",
      reason: "needsLogin",
    });
  });

  void it("stops for a missing permission", () => {
    assert.deepEqual(planFailure(http(403, "permission_denied"), CONTEXT), {
      action: "block",
      reason: "forbidden",
    });
  });

  void it("waits as long as the server asks on sync_in_progress and throttling, never less than the minimum", () => {
    const busy = planFailure(http(429, "sync_in_progress", { retryAfterSeconds: 2 }), CONTEXT);
    const throttled = planFailure(http(429, "throttled", { retryAfterSeconds: 0 }), CONTEXT);
    const unspecified = planFailure(http(429, "throttled"), CONTEXT);

    assert.deepEqual(busy, { action: "wait", retryAfterMs: 2000 });
    assert.deepEqual(throttled, { action: "wait", retryAfterMs: BACKOFF.minRetryAfterMs });
    assert.equal(unspecified.action, "wait");
  });

  void it("drops the cursor once on invalid_cursor, then falls back to a normal retry", () => {
    const failure = http(400, "invalid_cursor");

    assert.deepEqual(planFailure(failure, CONTEXT), { action: "resetCursor" });
    assert.deepEqual(planFailure(failure, { ...CONTEXT, cursorAlreadyReset: true }), {
      action: "retry",
      retryAfterMs: null,
    });
  });

  void it("splits an oversized batch, and parks a single event that is too large by itself", () => {
    const failure = http(413, "payload_too_large");

    assert.deepEqual(planFailure(failure, CONTEXT), { action: "splitBatch" });
    assert.deepEqual(planFailure(failure, { ...CONTEXT, batchSize: 1 }), { action: "park" });
  });

  void it("asks for the clock to be fixed when sent_at is out of range, and parks other malformed envelopes", () => {
    const clock = http(400, "validation_error", { fieldCodes: { sent_at: ["out_of_range"] } });
    const malformed = http(400, "validation_error", {
      fieldCodes: { "events.3.type": ["required"] },
    });

    assert.deepEqual(planFailure(clock, CONTEXT), { action: "block", reason: "clockWrong" });
    assert.deepEqual(planFailure(malformed, CONTEXT), { action: "park" });
    assert.deepEqual(planFailure(http(400, "parse_error"), CONTEXT), { action: "park" });
  });
});

void describe("retry timing", () => {
  void it("grows with consecutive failures, always keeps at least half the ceiling, and stops at the cap", () => {
    const lowest = (failures: number) => backoffDelayMs(failures, 0);
    const highest = (failures: number) => backoffDelayMs(failures, 0.999999);

    assert.equal(lowest(1), BACKOFF.baseMs / 2);
    assert.equal(highest(1), BACKOFF.baseMs);
    assert.ok(lowest(3) > highest(1));
    assert.equal(highest(40), BACKOFF.maxMs);
    assert.equal(lowest(40), BACKOFF.maxMs / 2);
  });

  void it("treats a zero or negative failure count as the first failure", () => {
    assert.equal(backoffDelayMs(0, 0), backoffDelayMs(1, 0));
  });

  void it("keeps a server Retry-After between the minimum and the cap", () => {
    assert.equal(retryAfterDelayMs(0), BACKOFF.minRetryAfterMs);
    assert.equal(retryAfterDelayMs(7), 7000);
    assert.equal(retryAfterDelayMs(100_000), BACKOFF.maxMs);
  });
});
