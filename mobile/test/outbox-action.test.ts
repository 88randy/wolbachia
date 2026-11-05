import assert from "node:assert/strict";
import { it } from "node:test";

import { performOutboxAction } from "../src/outbox/use-outbox-action.ts";
import { createStores, makeEnvelope } from "./support/factories.ts";

void it("turns a failed enqueue into on-screen storage feedback and saves no event", async () => {
  const { outbox, db } = await createStores();
  await db.runAtomically([
    {
      sql: "CREATE TRIGGER disk_full BEFORE INSERT ON outbox_event BEGIN SELECT RAISE(ABORT, 'Disk full'); END",
    },
  ]);

  const feedback = await performOutboxAction(() => outbox.enqueue(makeEnvelope()));

  assert.equal(feedback, "mobile.storage.saveFailed");
  assert.equal((await outbox.countByStatus()).pending, 0);
});

void it("handles a failed retry action with feedback instead of an unhandled rejection", async () => {
  const feedback = await performOutboxAction(() => Promise.reject(new Error("Disk unavailable")));
  assert.equal(feedback, "mobile.storage.actionFailed");
});
