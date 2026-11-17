import assert from "node:assert/strict";
import { test } from "node:test";
import { actionErrorKey } from "../src/features/ovitrap-check/action-error-key.ts";
import { currentEventId, harness, serviceFor } from "./support/m-08-harness.ts";
import { POINT } from "./support/m-08-fixtures.ts";
import { makeEnvelope } from "./support/factories.ts";
import { OutboxWriteError } from "../src/outbox/outbox-repository.ts";

const DAY = 24 * 60 * 60 * 1000;
const TODAY_SHIFT = "99999999-9999-4999-8999-999999999999";
const LABEL = "wbf:1:ovitrap:66666666-6666-4666-8666-666666666666";
const CHECKLIST = ["clean", "water", "liner", "shade", "height", "containers", "safe", "marked"];

/** Yesterday's placement: label scanned, two photos, checklist done, acknowledged; its shift then closed. */
async function yesterdaysFinishedDraft(options: { readonly closeShift: boolean }) {
  const h = await harness();
  let photo = 0;
  const service = serviceFor(
    { store: h.store, engine: h.engine },
    {
      evidence: {
        capture: (context) =>
          Promise.resolve({
            id: `eeeeeeee-eeee-4eee-8eee-${String(++photo).padStart(12, "0")}`,
            fileRef: `file:///evidence/${String(photo)}.jpg`,
            authority: {
              sql: "SELECT 1 FROM ovitrap_draft WHERE slot=1 AND event_id IS NULL AND json_extract(draft,'$.eventId')=?",
              params: [context.draftId],
            },
          }),
      },
    },
  );
  await service.startPlace(await currentEventId(h.store));
  const eventId = await currentEventId(h.store);
  assert.equal(await service.bindLabel(LABEL, false, eventId), "read");
  await service.update(
    { point: POINT, prepared: CHECKLIST, reviewAcknowledged: true },
    await currentEventId(h.store),
  );
  await service.captureEvidence(await currentEventId(h.store));
  await service.captureEvidence(await currentEventId(h.store));
  const started = (await h.store.read()).draft;
  assert.ok(started);
  assert.equal(started.evidence.length, 2);
  if (options.closeShift)
    await h.outbox.enqueue(
      makeEnvelope({
        type: "shift.close",
        shift_id: started.shiftId,
        device_time: new Date(Date.parse(started.deviceTime) + 60_000).toISOString(),
      }),
    );
  const later = serviceFor(
    { store: h.store, engine: h.engine },
    {
      now: () => new Date(Date.parse(started.deviceTime) + DAY),
      shiftId: () => Promise.resolve(TODAY_SHIFT),
    },
  );
  return { h, later, started };
}

for (const closeShift of [false, true]) {
  void test(`finishing a stale placement with photos saves it with its original time (shift closed: ${String(closeShift)})`, async () => {
    const { h, later, started } = await yesterdaysFinishedDraft({ closeShift });
    const eventId = await currentEventId(h.store);
    await later.continueStale(eventId);
    const saved = await later.save(eventId);
    assert.ok(saved.event, "a finished stale placement must produce an outbox event");
    assert.equal(saved.event.envelope.type, "ovitrap.place");
    assert.equal(saved.event.envelope.device_time, started.deviceTime);
    assert.equal(saved.event.envelope.shift_id, started.shiftId);
    assert.equal(saved.event.status, "pending");
  });
}

void test("a stale capture made after the shift closed says so instead of blaming storage", async () => {
  const { h, later, started } = await yesterdaysFinishedDraft({ closeShift: false });
  await h.outbox.enqueue(
    makeEnvelope({
      type: "shift.close",
      shift_id: started.shiftId,
      device_time: new Date(Date.parse(started.deviceTime) - 60_000).toISOString(),
    }),
  );
  const eventId = await currentEventId(h.store);
  await later.continueStale(eventId);
  const error = await later.save(eventId).then(
    () => null,
    (failure: unknown) => failure,
  );
  assert.ok(error instanceof OutboxWriteError);
  assert.equal(error.reason, "shift_closed");
  assert.equal(actionErrorKey(error), "mobile.storage.shiftClosed");
});

void test("only a really full phone says to free up space", () => {
  const full = new OutboxWriteError(new Error("database or disk is full"));
  assert.equal(full.reason, "storage_full");
  assert.equal(actionErrorKey(full), "mobile.storage.saveFailed");
  const other = new OutboxWriteError(
    new Error("UNIQUE constraint failed: ovitrap_capture.event_id"),
  );
  assert.equal(actionErrorKey(other), "mobile.storage.unexpected");
  assert.equal(actionErrorKey(new Error("boom")), "mobile.storage.unexpected");
});
