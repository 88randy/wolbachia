import assert from "node:assert/strict";
import { test } from "node:test";

import { OutboxWriteError } from "../src/outbox/outbox-repository.ts";
import { actionErrorKey } from "../src/features/ovitrap-check/action-error-key.ts";
import { describeWriteFailure } from "../src/features/diagnostics/diagnostic-log.ts";
import { ASSIGNMENT, CATALOG, POINT, RULES } from "./support/m-08-fixtures.ts";
import { hydrateLifecycleCaptureFixture } from "./support/lifecycle-capture-fixture.ts";
import { makeEnvelope } from "./support/factories.ts";
import { currentEventId, harness, publishSnapshots, serviceFor } from "./support/m-08-harness.ts";

const DAY = 24 * 60 * 60 * 1000;
const LABEL = "wbf:1:ovitrap:66666666-6666-4666-8666-666666666666";
const OTHER_POINT = { ...POINT, id: "77777777-7777-4777-8777-777777777777", code: "OV-2" };

/** Draft started under assignment A, finished; its shift then closed; no shift open the next day. */
async function lateDraft() {
  const h = await harness();
  await h.service.startPlace(await currentEventId(h.store));
  const eventId = await currentEventId(h.store);
  assert.equal(await h.service.bindLabel(LABEL, false, eventId), "read");
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
  const later = serviceFor(
    { store: h.store, engine: h.engine },
    {
      now: () => new Date(Date.parse(started.deviceTime) + DAY),
      shiftId: () => Promise.resolve(""),
    },
  );
  return { h, later, eventId, started };
}

void test("a late capture saves when today's assignment no longer lists its point", async () => {
  const { h, later, eventId, started } = await lateDraft();
  // Today's scope is another assignment: the point of the old draft is not in it.
  await publishSnapshots(h.store, {
    catalog: CATALOG,
    rules: RULES,
    assignment: { ...ASSIGNMENT, version: "assignment-v2", points: [OTHER_POINT], ovitraps: [] },
  });
  // The downloaded capture scope still grants both points.
  await hydrateLifecycleCaptureFixture(
    h.db,
    { ...ASSIGNMENT, points: [POINT, OTHER_POINT], ovitraps: [] },
    { force: true },
  );
  assert.equal((await later.read()).staleDraft?.invalidReason, null);
  await later.continueStale(eventId);
  const saved = await later.save(eventId);
  assert.equal(saved.event?.envelope.device_time, started.deviceTime);
  assert.equal(saved.event?.envelope.shift_id, started.shiftId);
});

void test("a normal capture is still refused by the trigger when its point left the scope", async () => {
  const h = await harness();
  await h.service.startPlace(await currentEventId(h.store));
  const eventId = await currentEventId(h.store);
  assert.equal(await h.service.bindLabel(LABEL, false, eventId), "read");
  await h.service.update(
    {
      point: POINT,
      prepared: ["clean", "water", "liner", "shade", "height", "containers", "safe", "marked"],
      reviewAcknowledged: true,
    },
    eventId,
  );
  await h.service.captureEvidence(eventId);
  await publishSnapshots(h.store, {
    catalog: CATALOG,
    rules: RULES,
    assignment: { ...ASSIGNMENT, version: "assignment-v2", points: [OTHER_POINT], ovitraps: [] },
  });
  await assert.rejects(h.service.save(eventId));
});

void test("a draft whose point was never in its own scope is blocked up front with the reason", async () => {
  const { h, later } = await lateDraft();
  await h.db.runAtomically([
    {
      sql: "UPDATE ovitrap_draft SET draft=json_set(draft,'$.assignment.points',json(?)) WHERE slot=1",
      params: [JSON.stringify([OTHER_POINT])],
    },
  ]);
  assert.equal((await later.read()).staleDraft?.invalidReason, "point");
});

void test("a point removed from the phone's capture scope is blocked up front, not at the last step", async () => {
  const { h, later } = await lateDraft();
  await h.db.runAtomically([
    { sql: "UPDATE day_sampling_point SET removed=1 WHERE id=?", params: [POINT.id] },
  ]);
  assert.equal((await later.read()).staleDraft?.invalidReason, "scope");
});

void test("the trigger's own text reads as a trigger with a real reason", () => {
  const error = new OutboxWriteError(
    new Error(
      "[op-sqlite] statement execution error: current M08 assignment, capture scope or epoch is unavailable (code 19, extended code 1811)",
    ),
  );
  assert.equal(error.reason, "scope_unavailable");
  assert.match(error.diagnostic, /SQLITE_CONSTRAINT_TRIGGER current M08 assignment/);
  assert.equal(actionErrorKey(error), "mobile.storage.scopeUnavailable");
  assert.match(
    describeWriteFailure(new Error("x error: some fixed raise text here (code 19, y")),
    /SQLITE_CONSTRAINT_TRIGGER/,
  );
});
