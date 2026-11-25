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
import { CONTRACT_IDS as ID } from "./support/lifecycle-contract-fixtures.ts";
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

function bundleFor(db: SqlExecutor, grants?: typeof OTHER_SCOPE) {
  const body = projectionBundle();
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

async function seeded(grants?: typeof OTHER_SCOPE) {
  const local = await openTestDatabase(":memory:");
  const outbox = new OutboxRepository(local.executor, () => PROJECTION_NOW);
  for (const event of [fuel, opening, segment]) await outbox.enqueue(event);
  return { local, outbox, bundle: bundleFor(local.executor, grants) };
}

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

void test("P33 D1 unavailable history gives no unscoped rows", async (t) => {
  const { local } = await seeded();
  t.after(local.close);

  assert.deepEqual(await readHistory(local.executor, PROJECTION_IDENTITY, "courier"), {
    available: false,
    entries: [],
    unscoped: [],
  });
});

void test("P33 wiring: a saved event shows on its day in the subscriber's re-read", async (t) => {
  const local = await openTestDatabase(":memory:");
  t.after(local.close);
  const bundle = bundleFor(local.executor);
  await bundle.refresh();
  const auth = {
    subscribe: () => () => undefined,
    getSnapshot: () =>
      ({
        phase: "unlocked",
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
  const calendar = new CalendarService({ history, bundle, auth, now: () => PROJECTION_NOW });
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
});
