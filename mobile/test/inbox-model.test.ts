import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { eventTypeKey, problemMessageKey, snakeToCamel } from "../src/sync/inbox-model.ts";
import type { ProblemItem } from "../src/outbox/outbox-event.ts";

function problem(overrides: Partial<ProblemItem>): ProblemItem {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    type: "ovitrap.check",
    status: "rejected",
    deviceTime: "2026-01-15T10:00:00.000Z",
    attempts: 0,
    lastError: null,
    result: null,
    ...overrides,
  };
}

void describe("inbox messages", () => {
  void it("turns server codes and event types into catalog key segments", () => {
    assert.equal(snakeToCamel("void_target_not_found"), "voidTargetNotFound");
    assert.equal(snakeToCamel("ovitrap.check"), "ovitrapCheck");
  });

  void it("labels known event types and falls back for new ones, never showing the raw type", () => {
    assert.equal(eventTypeKey("ovitrap.check"), "mobile.eventType.ovitrapCheck");
    assert.equal(eventTypeKey("future.thing"), "mobile.eventType.unknown");
  });

  void it("explains a problem with the server's code when the app knows it", () => {
    const rejected = problem({ result: { code: "void_target_not_found", params: {} } });

    assert.equal(problemMessageKey(rejected), "sync.result.voidTargetNotFound");
  });

  void it("falls back to the generic hint of the status for an unknown code or no code", () => {
    const unknown = problem({ result: { code: "brand_new_code", params: {} } });
    const reviewed = problem({ status: "in_review", result: null });
    const parked = problem({ status: "error", lastError: "validation_error" });

    assert.equal(problemMessageKey(unknown), "sync.inbox.rejectedHint");
    assert.equal(problemMessageKey(reviewed), "sync.inbox.inReviewHint");
    assert.equal(problemMessageKey(parked), "mobile.inbox.parkedHint");
  });
});
