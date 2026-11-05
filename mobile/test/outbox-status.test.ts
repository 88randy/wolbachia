import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyOutboxAction, OUTBOX_STATUSES } from "../src/outbox/outbox-status.ts";
import type { OutboxAction, OutboxStatus } from "../src/outbox/outbox-status.ts";

function from(status: OutboxStatus, attempts = 0) {
  return { status, attempts };
}

/** Every (action, current status) pair that is allowed, with where it leads. */
const ALLOWED: readonly (readonly [OutboxAction, OutboxStatus, OutboxStatus])[] = [
  ["claim", "pending", "sending"],
  ["accept", "sending", "sent"],
  ["reject", "sending", "rejected"],
  ["review", "sending", "in_review"],
  ["failTransient", "sending", "pending"],
  ["failPermanent", "sending", "error"],
  ["release", "sending", "pending"],
  ["recover", "sending", "pending"],
  ["retryNow", "error", "pending"],
  ["pulledRejected", "pending", "rejected"],
  ["pulledRejected", "sending", "rejected"],
  ["pulledRejected", "sent", "rejected"],
  ["pulledInReview", "pending", "in_review"],
  ["pulledInReview", "sending", "in_review"],
  ["pulledInReview", "sent", "in_review"],
];

void describe("outbox state machine", () => {
  void it("allows exactly the documented transitions and refuses every other pair", () => {
    for (const [action, status, expected] of ALLOWED) {
      assert.equal(
        applyOutboxAction(from(status), action)?.status,
        expected,
        `${action}/${status}`,
      );
    }
    const actions = [...new Set(ALLOWED.map(([action]) => action))];
    const allowedPairs = new Set(ALLOWED.map(([action, status]) => `${action}/${status}`));
    const pairs = actions.flatMap((action) =>
      OUTBOX_STATUSES.map((status) => [action, status] as const),
    );
    for (const [action, status] of pairs) {
      if (allowedPairs.has(`${action}/${status}`)) continue;
      assert.equal(applyOutboxAction(from(status), action), null, `${action}/${status}`);
    }
  });

  void it("counts an attempt only when a send failed", () => {
    const failed = applyOutboxAction(from("sending", 2), "failTransient");
    const parked = applyOutboxAction(from("sending", 2), "failPermanent");
    const released = applyOutboxAction(from("sending", 2), "release");
    const recovered = applyOutboxAction(from("sending", 2), "recover");

    assert.equal(failed?.attempts, 3);
    assert.equal(parked?.attempts, 3);
    assert.equal(released?.attempts, 2);
    assert.equal(recovered?.attempts, 2);
  });

  void it("never lets a rejected or in-review event go back to the queue", () => {
    for (const status of ["rejected", "in_review"] as const) {
      for (const action of ["claim", "retryNow", "recover", "release"] as const) {
        assert.equal(applyOutboxAction(from(status), action), null, `${action}/${status}`);
      }
    }
  });

  void it("parks an event as error until a person retries, and keeps its attempts", () => {
    const parked = applyOutboxAction(from("sending", 1), "failPermanent");
    assert.ok(parked);

    assert.equal(applyOutboxAction(parked, "claim"), null);
    assert.deepEqual(applyOutboxAction(parked, "retryNow"), { status: "pending", attempts: 2 });
  });
});
