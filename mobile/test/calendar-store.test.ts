import assert from "node:assert/strict";
import { test } from "node:test";
import type { SqlExecutor } from "../src/db/sql.ts";
import { DayStore } from "../src/features/day/store.ts";
import { DayBundleService } from "../src/features/day/bundle-service.ts";
import { readHistory } from "../src/features/history/store.ts";
import { HistoryService } from "../src/features/history/service.ts";
import { CalendarService } from "../src/features/calendar/service.ts";
import type { CalendarView } from "../src/features/calendar/service.ts";
import { OutboxRepository } from "../src/outbox/outbox-repository.ts";
import { makeEnvelope } from "./support/factories.ts";
import { openTestDatabase } from "./support/sqlite-executor.ts";
import { CONTRACT_IDS as ID, REVIEW_HISTORY } from "./support/lifecycle-contract-fixtures.ts";
import {
  PROJECTION_IDENTITY,
  PROJECTION_NOW,
  projectionBundle,
} from "./support/lifecycle-projection-fixtures.ts";

const OTHER_SCOPE = [
  {
    centers: { mode: "selected" as const, ids: [ID.otherCenter] },
    quadrants: { mode: "selected" as const, ids: [ID.otherQuadrant] },
  },
];

function bundleFor(db: SqlExecutor, grants?: typeof OTHER_SCOPE, history: unknown[] = []) {
  const body = { ...projectionBundle(), history };
  const context = grants ? { ...body.capture_context, grants } : body.capture_context;
  return new DayBundleService({
    store: new DayStore(db),
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: () =>
      Promise.resolve({ kind: "bundle", body: { ...body, capture_context: context } }),
  });
}
const fuel = makeEnvelope({
  type: "fuel.load",
  device_time: "2026-11-06T15:00:00.000Z",
  payload: { liters: 12, motorcycle_code: "M-7", reason: "Private fuel note" },
});
const opening = makeEnvelope({
  type: "shift.open",
  shift_id: ID.device,
  device_time: "2026-11-06T13:00:00.000Z",
  payload: { odometer_km: 1200 },
});
const segment = makeEnvelope({ type: "track.segment", payload: { positions: [] } });

async function seeded(grants?: typeof OTHER_SCOPE, history: unknown[] = []) {
  const local = await openTestDatabase(":memory:");
  const outbox = new OutboxRepository(local.executor, () => PROJECTION_NOW);
  for (const event of [fuel, opening, segment]) await outbox.enqueue(event);
  return { local, outbox, bundle: bundleFor(local.executor, grants, history) };
}
/** A server history row placing `eventId` in the Q1 pair, which OTHER_SCOPE does not grant. */
const placedInQ1 = (eventId: string, index: number) => ({
  ...REVIEW_HISTORY,
  id: `00000000-0000-4000-8000-0000000009${String(index).padStart(2, "0")}`,
  source_event_id: eventId,
  subjects: [{ center_id: ID.center, quadrant_id: ID.quadrant }],
});

void test("P33 D1 pending fuel load and shift open are unscoped rows with type, time and status only", async (t) => {
  const { local, bundle } = await seeded();
  t.after(local.close);
  await bundle.refresh();

  const view = await readHistory(local.executor, PROJECTION_IDENTITY, "courier");

  assert.deepEqual(
    [...view.unscoped].sort((left, right) => left.kind.localeCompare(right.kind)),
    [
      { id: fuel.id, kind: "fuel.load", time: fuel.device_time, status: "pending" },
      { id: opening.id, kind: "shift.open", time: opening.device_time, status: "pending" },
    ],
  );
  assert.equal(view.entries.length, 0, "P29 still hides events without a granted subject");
});

void test("P33 D1 a point event outside the current grant stays hidden from both lists", async (t) => {
  const { local, outbox, bundle } = await seeded(OTHER_SCOPE);
  t.after(local.close);
  const point = makeEnvelope({ payload: { sampling_point_id: ID.point, bag_code: "B-A" } });
  const pointVoid = makeEnvelope({
    type: "record.void",
    voids_event_id: point.id,
    payload: { reason: "mistake" },
  });
  await outbox.enqueue(point);
  await outbox.enqueue(pointVoid);
  await bundle.refresh();

  const view = await readHistory(local.executor, PROJECTION_IDENTITY, "courier");

  assert.deepEqual(view.entries, []);
  assert.deepEqual(view.unscoped.map((entry) => entry.kind).sort(), ["fuel.load", "shift.open"]);
});

void test("P33 D1 release, sample, their voids and a server-placed incident outside the grant stay hidden", async (t) => {
  const release = makeEnvelope({ type: "release.record", payload: { lot_code: "L-1" } });
  const sample = makeEnvelope({ type: "sample.collect", payload: { sample_code: "S-1" } });
  const incident = makeEnvelope({ type: "incident.report", payload: { category: "dog" } });
  const voids = [release, sample].map((original) =>
    makeEnvelope({ type: "record.void", voids_event_id: original.id, payload: { reason: "x" } }),
  );
  const { local, outbox, bundle } = await seeded(
    OTHER_SCOPE,
    [release, sample, incident].map((event, index) => placedInQ1(event.id, index)),
  );
  t.after(local.close);
  for (const event of [release, sample, incident, ...voids]) await outbox.enqueue(event);
  await outbox.claimPending(10);
  await outbox.settle([release, sample].map((event) => ({ id: event.id, action: "accept" })));
  await bundle.refresh();

  const view = await readHistory(local.executor, PROJECTION_IDENTITY, "courier");

  assert.deepEqual(view.entries, []);
  assert.deepEqual(view.unscoped.map((entry) => entry.kind).sort(), ["fuel.load", "shift.open"]);
});
void test("P33 wiring: a saved event shows on its day in the subscriber's re-read", async (t) => {
  const local = await openTestDatabase(":memory:");
  t.after(local.close);
  const bundle = bundleFor(local.executor);
  await bundle.refresh();
  const session = { phase: "unlocked" };
  const auth = {
    subscribe: () => () => undefined,
    getSnapshot: () =>
      ({
        phase: session.phase,
        profile: { organization: { timezone: "America/Merida", epi_week: "mmwr" } },
      }) as unknown as ReturnType<
        ConstructorParameters<typeof HistoryService>[0]["auth"]["getSnapshot"]
      >,
  };
  const history = new HistoryService({
    db: local.executor,
    bundle,
    auth,
    current: () => PROJECTION_IDENTITY,
  });
  const current = () => PROJECTION_IDENTITY;
  const calendar = new CalendarService({
    history,
    bundle,
    auth,
    current,
    now: () => PROJECTION_NOW,
  });
  let reread!: (view: CalendarView) => void;
  const notified = new Promise<CalendarView>((resolve) => {
    reread = resolve;
  });
  const stop = calendar.subscribe(() => {
    void calendar.read().then(reread);
  });
  t.after(stop);

  await new OutboxRepository(local.executor, () => PROJECTION_NOW).enqueue(fuel);
  await bundle.refresh(true);

  const view = await notified;
  assert.equal(view.today, "2026-11-06");
  const day = view.days.find((candidate) => candidate.date === "2026-11-06");
  assert.deepEqual(
    day?.items.map((item) => [item.id, item.status, item.source]),
    [[fuel.id, "pending", "local"]],
  );
  assert.equal(day.hasPending, true);

  session.phase = "locked";
  const locked = await calendar.read();
  assert.equal(locked.identityKey, null);
  assert.ok(
    locked.days.every((candidate) => candidate.items.length === 0),
    "nothing while locked",
  );
});
