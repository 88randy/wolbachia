import assert from "node:assert/strict";
import { test } from "node:test";

import { homeNext } from "../src/features/shift-open/home-next.ts";
import { homeLock, isClosedLock } from "../src/features/shift-open/home-lock.ts";
import { ShiftOpenService } from "../src/features/shift-open/service.ts";
import { ShiftOpenStore } from "../src/features/shift-open/store.ts";
import { engineFor } from "./support/m-08-harness.ts";
import { createStores, FIXED_NOW, makeEnvelope } from "./support/factories.ts";
import { currentEventId, harness as ovitrapHarness, serviceFor } from "./support/m-08-harness.ts";
import { POINT } from "./support/m-08-fixtures.ts";

const READY = { status: "ready", coverage: "full", bytes: 1 } as never;
const CHECKS = [{ item: "brakes", result: "ok" }] as never;

async function shiftHarness() {
  const local = await createStores();
  const store = new ShiftOpenStore(local.db);
  await store.saveCatalog({
    version: "catalog-v1",
    items: [{ code: "brakes", label: "Brakes", severity: "severe" }],
  } as never);
  let sequence = 0;
  const service = new ShiftOpenService({
    store,
    engine: engineFor(local),
    now: () => FIXED_NOW,
    uuid: () => `11111111-1111-4111-8111-${String(++sequence).padStart(12, "0")}`,
    maps: {
      prepare: async (publish) => {
        await publish(READY);
        return READY;
      },
    },
    photos: { capture: () => Promise.resolve({ status: "unavailable" }) },
  });
  return { ...local, service };
}

void test("after closing the shift, Mi dia offers to open a new one and says why the tiles are off", async () => {
  const h = await shiftHarness();
  await h.service.start();
  await h.service.update({ motorcycle_code: "M-03", step: "checklist" });
  await h.service.update({ checks: CHECKS, odometer_km: "12480", step: "maps" });
  await h.service.prepareMap();
  const opened = await h.service.open();
  assert.ok(opened.opening);
  const shiftId = opened.opening.envelope.shift_id;
  // While the shift is open, starting again changes nothing.
  assert.equal((await h.service.start()).opening?.envelope.id, opened.opening.envelope.id);

  await h.outbox.enqueue(makeEnvelope({ type: "shift.close", shift_id: shiftId }));
  const closed = await h.service.read();
  assert.equal(homeNext(closed), "closed");
  assert.equal(isClosedLock(homeLock(closed)), true);

  const fresh = await h.service.start();
  assert.equal(fresh.opening, null);
  assert.ok(fresh.draft);
  assert.notEqual(fresh.draft.clientShiftId, shiftId);
  assert.equal(homeNext(fresh), "resume");
  // The closed shift's events are still in the outbox.
  assert.equal((await h.outbox.countByStatus()).pending >= 2, true);
});

void test("a stale unfinished placement can be finished and saved with no shift open", async () => {
  const h = await ovitrapHarness();
  await h.service.startPlace(await currentEventId(h.store));
  const eventId = await currentEventId(h.store);
  assert.equal(
    await h.service.bindLabel("wbf:1:ovitrap:66666666-6666-4666-8666-666666666666", false, eventId),
    "read",
  );
  await h.service.update(
    {
      point: POINT,
      prepared: ["clean", "water", "liner", "shade", "height", "containers", "safe", "marked"],
      reviewAcknowledged: true,
    },
    eventId,
  );
  await h.service.captureEvidence(eventId);
  const started = (await h.store.read()).draft;
  assert.ok(started);
  await h.outbox.enqueue(
    makeEnvelope({
      type: "shift.close",
      shift_id: started.shiftId,
      device_time: new Date(Date.parse(started.deviceTime) + 60_000).toISOString(),
    }),
  );
  const noShift = serviceFor(
    { store: h.store, engine: h.engine },
    {
      now: () => new Date(Date.parse(started.deviceTime) + 86_400_000),
      shiftId: () => Promise.resolve(""),
    },
  );
  assert.equal(await noShift.unfinishedCount(), 1);
  assert.ok((await noShift.read()).staleDraft);
  await noShift.continueStale(eventId);
  const saved = await noShift.save(eventId);
  assert.equal(saved.event?.envelope.device_time, started.deviceTime);
  assert.equal(saved.event?.envelope.shift_id, started.shiftId);
});
