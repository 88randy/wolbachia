import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { IDLE_SYNC_GAP_MS } from "../src/sync/idle-gap.ts";
import { runSyncPass, SYNC_BATCH_SIZE } from "../src/sync/sync-pass.ts";
import { createStores, FIXED_DEVICE_ID, FIXED_NOW, makeEnvelope } from "./support/factories.ts";
import { accepted, answer, scriptedTransport } from "./support/scripted-transport.ts";

function passDeps(stores: Awaited<ReturnType<typeof createStores>>, fileDelayMs: number | null) {
  return {
    outbox: stores.outbox,
    kv: stores.kv,
    transport: scriptedTransport([answer([])]).transport,
    deviceId: FIXED_DEVICE_ID,
    now: () => FIXED_NOW,
    attachments: {
      selection: () => Promise.resolve({ fence: null, isFinal: false }),
      recoverInterrupted: () => Promise.resolve(),
      advanceOne: () => Promise.resolve(false),
      nextRetryDelayMs: () => Promise.resolve(fileDelayMs),
    },
  };
}

void describe("idle sync cadence", () => {
  void it("keeps the idle gap at a minute or more", () => {
    assert.equal(IDLE_SYNC_GAP_MS, 60_000);
  });

  void it("still sends a new outbox event in the same pass, without waiting", async () => {
    const stores = await createStores();
    const event = makeEnvelope();
    await stores.outbox.enqueue(event);
    const scripted = scriptedTransport([answer([accepted(event.id)])]);
    const outcome = await runSyncPass(
      { ...passDeps(stores, null), transport: scripted.transport },
      { batchSize: SYNC_BATCH_SIZE },
    );
    assert.equal(outcome.kind, "idle");
    assert.equal(scripted.requests[0]?.events[0]?.id, event.id);
  });
});
