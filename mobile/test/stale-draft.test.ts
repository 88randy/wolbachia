import assert from "node:assert/strict";
import { test } from "node:test";
import { currentEventId, harness, publishSnapshots, serviceFor } from "./support/m-08-harness.ts";
import { ASSIGNMENT, CATALOG, RULES } from "./support/m-08-fixtures.ts";

const DAY = 24 * 60 * 60 * 1000;
const TODAY_SHIFT = "99999999-9999-4999-8999-999999999999";

/** The draft is made now (the fixture clock); "tomorrow" is the same phone a day later, another shift. */
async function tomorrow() {
  const h = await harness();
  await h.service.startPlace(await currentEventId(h.store));
  const eventId = await currentEventId(h.store);
  assert.ok(eventId);
  const started = (await h.store.read()).draft;
  assert.ok(started);
  const later = serviceFor(
    { store: h.store, engine: h.engine },
    {
      now: () => new Date(Date.parse(started.deviceTime) + DAY),
      shiftId: () => Promise.resolve(TODAY_SHIFT),
    },
  );
  return { h, later, eventId, started };
}

void test("a draft from yesterday offers the choice instead of failing at save", async () => {
  const { later } = await tomorrow();
  const snapshot = await later.read();
  assert.ok(snapshot.staleDraft);
  assert.equal(snapshot.staleDraft.invalidReason, null);
  assert.equal(snapshot.staleDraft.createdAt, snapshot.draft?.deviceTime);
});

void test("a draft of the current shift is not offered as stale", async () => {
  const h = await harness();
  await h.service.startPlace(await currentEventId(h.store));
  assert.equal((await h.service.read()).staleDraft, null);
});

void test("finishing it keeps the original time and the closed shift, and no longer asks", async () => {
  const { later, eventId, started } = await tomorrow();
  await later.continueStale(eventId);
  const snapshot = await later.read();
  assert.equal(snapshot.staleDraft, null);
  assert.equal(snapshot.draft?.isLate, true);
  assert.equal(snapshot.draft?.deviceTime, started.deviceTime);
  assert.equal(snapshot.draft?.shiftId, started.shiftId);
  assert.equal(snapshot.isShiftBlocked, false);
});

void test("starting again drops the old draft and the next capture is fresh", async () => {
  const { h, later, eventId, started } = await tomorrow();
  await later.discardStale(eventId);
  assert.equal((await h.store.read()).draft, null);
  await later.startPlace(null);
  const fresh = (await h.store.read()).draft;
  assert.ok(fresh);
  assert.notEqual(fresh.eventId, started.eventId);
  assert.equal(fresh.shiftId, TODAY_SHIFT);
  assert.equal((await later.read()).staleDraft, null);
});

void test("a draft whose point left the route says so and cannot be finished", async () => {
  const { h, later, eventId } = await tomorrow();
  const draft = (await h.store.read()).draft;
  assert.ok(draft);
  const point = ASSIGNMENT.points[0];
  assert.ok(point);
  assert.ok(await h.store.update({ ...draft, point }, JSON.stringify(draft)));
  await publishSnapshots(h.store, {
    catalog: CATALOG,
    rules: RULES,
    assignment: {
      ...ASSIGNMENT,
      points: [{ ...point, id: "77777777-7777-4777-8777-777777777777" }],
    },
  });
  const snapshot = await later.read();
  assert.equal(snapshot.staleDraft?.invalidReason, "point");
  await assert.rejects(later.continueStale(eventId));
  // The only way out is to start again.
  await later.discardStale(eventId);
  assert.equal(await later.unfinishedCount(), 0);
});

void test("the unfinished count is 1 while a draft exists and 0 after discarding it", async () => {
  const { later, eventId } = await tomorrow();
  assert.equal(await later.unfinishedCount(), 1);
  await later.discardStale(eventId);
  assert.equal(await later.unfinishedCount(), 0);
});
