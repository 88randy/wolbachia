import assert from "node:assert/strict";
import { test } from "node:test";

import type { SqlExecutor } from "../src/db/sql.ts";
import { eventInsertStatement } from "../src/outbox/outbox-repository.ts";
import { simplifyTrack, metersBetween } from "../src/features/track/simplify-track.ts";
import type { TrackFix } from "../src/features/track/simplify-track.ts";
import { keepFix } from "../src/features/track/track-filter.ts";
import type { RawFix } from "../src/features/track/track-filter.ts";
import { TrackRecorder } from "../src/features/track/track-recorder.ts";
import type { NativeTrackApi, TrackStartOptions } from "../src/features/track/track-recorder.ts";
import { readTrackRules } from "../src/features/track/track-rules.ts";
import {
  LOCAL_RETENTION_MS,
  MAX_SEGMENT_POSITIONS,
  TrackStore,
} from "../src/features/track/track-store.ts";
import { createTestDatabase } from "./support/sqlite-executor.ts";

const RULES = readTrackRules(null);
const T0 = Date.parse("2026-11-24T14:00:00.000Z");
const SHIFT = "11111111-1111-4111-8111-111111111111";
const OWNER = "owner-a";
/** ~1.1 m per 0.00001 degree of latitude: a fix this far north of the origin. */
const north = (meters: number, at: number, accuracyM = 10): TrackFix => ({
  at,
  lat: 21 + meters / 111_195,
  lng: -89.6,
  accuracyM,
});

function insertShiftEvent(db: SqlExecutor, type: "shift.open" | "shift.close", at: number) {
  return db.runAtomically([
    eventInsertStatement(
      {
        id: crypto.randomUUID(),
        type,
        schema_version: 1,
        device_time: new Date(at).toISOString(),
        shift_id: SHIFT,
        gps: null,
        rules_version: "r1",
        catalog_version: "c1",
        manual_capture: true,
        voids_event_id: null,
        payload: { odometer_km: 1 },
      },
      new Date(at).toISOString(),
    ),
  ]);
}

async function segments(db: SqlExecutor) {
  const rows = await db.query(
    "SELECT id, device_time, payload, shift_id FROM outbox_event WHERE type='track.segment' ORDER BY seq",
  );
  return rows.map((row) => ({
    id: String(row.id),
    deviceTime: String(row.device_time),
    payload: JSON.parse(String(row.payload)) as {
      started_at: string;
      positions: [number, number, number, number][];
    },
  }));
}

/** Native task, permissions and clock under the test's control; nothing waits on real time. */
function fixture(db: SqlExecutor, options: { isLocationGranted?: boolean } = {}) {
  const calls: string[] = [];
  const starts: TrackStartOptions[] = [];
  const state = { running: false, owner: OWNER as string | null, now: T0, startError: false };
  const native: NativeTrackApi = {
    prepare: () =>
      Promise.resolve({
        isLocationGranted: options.isLocationGranted ?? true,
        isNotificationGranted: true,
      }),
    start: (startOptions) => {
      calls.push("start");
      if (state.startError) return Promise.reject(new Error("ForegroundServiceStartNotAllowed"));
      starts.push(startOptions);
      state.running = true;
      return Promise.resolve();
    },
    stop: () => {
      calls.push("stop");
      state.running = false;
      return Promise.resolve();
    },
    isRunning: () => Promise.resolve(state.running),
  };
  let syncs = 0;
  const reports: string[] = [];
  const recorder = new TrackRecorder({
    store: new TrackStore(db),
    native,
    identity: () => state.owner,
    rules: () => Promise.resolve(RULES),
    texts: () => Promise.resolve({ title: "t", body: "b" }),
    versions: () => Promise.resolve({ rules: "r1", catalog: "c1" }),
    uuid: () => crypto.randomUUID(),
    now: () => state.now,
    requestSync: () => {
      syncs += 1;
    },
    report: (event) => {
      reports.push(event);
    },
  });
  return { recorder, calls, starts, state, reports, syncs: () => syncs };
}

const raw = (fix: TrackFix): RawFix => fix;

void test("Douglas-Peucker keeps first and last and every point beyond the tolerance", () => {
  const east = (fix: TrackFix, meters: number): TrackFix => ({
    ...fix,
    lng: fix.lng + meters / 103_900, // ~103.9 km per degree of longitude at 21 N
  });
  const start = north(0, T0);
  const end = north(400, T0 + 60_000);
  const jitter = [100, 200, 300].map((meters, index) =>
    east(north(meters, T0 + (index + 1) * 15_000), 2 * (index % 2 ? -1 : 1)),
  );
  assert.deepEqual(simplifyTrack([start, ...jitter, end], 5), [start, end], "2 m jitter goes");
  const kink = east(north(200, T0 + 30_000), 30);
  const near = east(north(100, T0 + 15_000), 15.5); // 0.5 m from the start-kink line
  assert.deepEqual(simplifyTrack([start, near, kink, end], 5), [start, kink, end]);
  assert.deepEqual(simplifyTrack([start, near, kink, end], 0), [start, near, kink, end]);
  // A point after a heartbeat-long gap is pinned even on a straight line.
  const stop = [
    north(0, T0),
    north(50, T0 + 15_000),
    north(100, T0 + 315_000),
    north(150, T0 + 330_000),
  ];
  assert.equal(simplifyTrack(stop, 5, 300_000).length, 3);
});

void test("the filter drops imprecise fixes and jitter, and keeps one fix per heartbeat while still", () => {
  assert.equal(keepFix(null, { ...north(0, T0), accuracyM: null }, RULES), false);
  assert.equal(keepFix(null, north(0, T0, 101), RULES), false);
  assert.equal(keepFix(null, north(0, T0, 100), RULES), true);
  const first = north(0, T0, 10);
  // 20 m moved but accuracy 30 m: within the uncertainty, dropped.
  assert.equal(keepFix(first, north(20, T0 + 15_000, 30), RULES), false);
  assert.equal(keepFix(first, north(31, T0 + 15_000, 30), RULES), true);
  assert.equal(keepFix(first, north(10, T0 + 15_000, 5), RULES), false, "under track_min_move_m");
  // Still for 20 minutes at a 15 s sample: the first fix plus one per 300 s heartbeat.
  let last: TrackFix | null = null;
  let kept = 0;
  for (let at = T0; at < T0 + 20 * 60_000; at += 15_000) {
    const fix = north(3 * Math.sin(at), at, 8);
    if (keepFix(last, fix, RULES)) {
      last = fix;
      kept += 1;
    }
  }
  assert.equal(kept, 4);
  assert.ok(metersBetween(north(0, T0), north(100, T0)) > 99.9);
});

void test("tracking starts only with an open local shift and stops on close, also offline", async () => {
  const db = await createTestDatabase();
  const { recorder, calls, starts, state, syncs } = fixture(db);
  await recorder.reconcile();
  assert.deepEqual(calls, [], "no shift: no service, no notification");
  await recorder.onFixes([raw(north(0, T0))]);
  assert.equal((await db.query("SELECT 1 FROM track_point")).length, 0, "no shift: fix discarded");

  await insertShiftEvent(db, "shift.open", T0);
  await recorder.reconcile();
  assert.deepEqual(calls, ["start"]);
  assert.deepEqual(starts[0], {
    isHighAccuracy: false,
    timeIntervalMs: 15_000,
    notificationTitle: "t",
    notificationBody: "b",
  });
  await recorder.reconcile();
  assert.deepEqual(calls, ["start"], "reconcile is idempotent while running");

  await recorder.onFixes([raw(north(0, T0 + 1000)), raw(north(50, T0 + 16_000))]);
  assert.equal((await recorder.currentLine()).length, 2, "P10 line comes from local points");
  // Close is local (no network in this test): the last segment is cut, then the service stops.
  await insertShiftEvent(db, "shift.close", T0 + 20_000);
  state.now = T0 + 21_000;
  await recorder.reconcile();
  assert.deepEqual(calls, ["start", "stop"]);
  const [segment] = await segments(db);
  assert.equal(segment?.payload.positions.length, 2);
  assert.equal(syncs(), 1);
  assert.deepEqual(await recorder.currentLine(), []);
  await recorder.onFixes([raw(north(100, T0 + 30_000))]);
  assert.equal((await db.query("SELECT 1 FROM track_point")).length, 2, "after close: discarded");
});

void test("logout, revocation or another owner stops tracking and flushes the owner's points", async () => {
  const db = await createTestDatabase();
  const { recorder, calls, state } = fixture(db);
  await insertShiftEvent(db, "shift.open", T0);
  await recorder.reconcile();
  await recorder.onFixes([raw(north(0, T0 + 1000))]);
  state.owner = "owner-b";
  await recorder.onFixes([raw(north(80, T0 + 16_000))]);
  const owners = await db.query("SELECT owner_user_id, segment_event_id FROM track_point");
  assert.deepEqual(
    owners.map((row) => row.owner_user_id),
    [OWNER],
    "the fix seen after the owner changed is not stored for anyone",
  );
  assert.notEqual(owners[0]?.segment_event_id, null, "the previous owner's point was cut");
  state.owner = null; // session ended (logout or remote revocation)
  await recorder.reconcile();
  assert.deepEqual(calls, ["start", "stop"]);
  assert.equal((await segments(db)).length, 1);
});

void test("denied location never blocks the shift and a refused service is retried on foreground", async () => {
  const db = await createTestDatabase();
  await insertShiftEvent(db, "shift.open", T0);
  const denied = fixture(db, { isLocationGranted: false });
  await denied.recorder.reconcile();
  assert.deepEqual(denied.calls, []);
  assert.equal(denied.recorder.getSnapshot().notice, "locationDenied");

  const refused = fixture(db);
  refused.state.startError = true;
  await refused.recorder.reconcile();
  assert.equal(refused.recorder.getSnapshot().notice, "unavailable");
  assert.deepEqual(refused.reports, ["track.start_failed"]);
  refused.state.startError = false;
  await refused.recorder.reconcile(); // next foreground
  assert.equal(refused.state.running, true);
  assert.equal(refused.recorder.getSnapshot().notice, null);
});

void test("app start stops a leftover service without a shift and resumes one with a shift", async () => {
  const db = await createTestDatabase();
  const leftover = fixture(db);
  leftover.state.running = true;
  await leftover.recorder.reconcile();
  assert.deepEqual(leftover.calls, ["stop"]);
  await insertShiftEvent(db, "shift.open", T0);
  const resumed = fixture(db);
  await resumed.recorder.reconcile();
  assert.deepEqual(resumed.calls, ["start"]);
});

void test("segments are cut on the upload interval, at most 250 positions within the contract", async () => {
  const db = await createTestDatabase();
  const { recorder, state } = fixture(db);
  await insertShiftEvent(db, "shift.open", T0);
  await recorder.reconcile();
  // A zigzag every 15 s survives simplification: 600 kept fixes.
  const fixes = Array.from({ length: 600 }, (_, index) => ({
    ...north(index * 20, T0 + 1000 + index * 15_000, 12.4),
    lng: -89.6 + (index % 2) * 0.0005,
  }));
  state.now = T0 + 299_000;
  await recorder.onFixes(fixes.slice(0, 300));
  assert.equal((await segments(db)).length, 0, "before the 300 s cadence nothing is cut");
  state.now = T0 + 10 * 60 * 60_000;
  await recorder.onFixes(fixes.slice(300));
  const cut = await segments(db);
  assert.deepEqual(
    cut.map((segment) => segment.payload.positions.length),
    [MAX_SEGMENT_POSITIONS, MAX_SEGMENT_POSITIONS, 100],
  );
  for (const segment of cut) {
    const offsets = segment.payload.positions.map(([offset]) => offset);
    assert.ok(
      offsets.every(
        (offset, index) => Number.isInteger(offset) && offset >= (offsets[index - 1] ?? 0),
      ),
    );
    assert.ok(
      segment.payload.positions.every(
        ([, lat, lng, accuracy]) =>
          Number(lat.toFixed(6)) === lat && Number(lng.toFixed(6)) === lng && accuracy === 12,
      ),
    );
    const last = segment.payload.positions[segment.payload.positions.length - 1]?.[0] ?? 0;
    assert.equal(
      Date.parse(segment.deviceTime),
      Date.parse(segment.payload.started_at) + last * 1000,
    );
  }
  const unsent = await db.query("SELECT 1 FROM track_point WHERE segment_event_id IS NULL");
  assert.equal(unsent.length, 0, "every point is carried by exactly one segment");
});

void test("segment enqueue and point stamping commit together or not at all", async () => {
  const db = await createTestDatabase();
  const store = new TrackStore(db);
  await insertShiftEvent(db, "shift.open", T0);
  await store.append(OWNER, SHIFT, [north(0, T0 + 1000), north(80, T0 + 16_000)]);
  await db.runAtomically([
    {
      sql: `CREATE TEMP TRIGGER fail_stamp BEFORE UPDATE OF segment_event_id ON track_point
        BEGIN SELECT RAISE(ABORT, 'disk full'); END`,
    },
  ]);
  const input = {
    owner: OWNER,
    rules: RULES,
    uuid: () => crypto.randomUUID(),
    now: () => T0,
    versions: { rules: "r1", catalog: "c1" },
  };
  await assert.rejects(store.cut(input), /disk full/);
  assert.equal((await segments(db)).length, 0, "the event rolled back with the stamp");
  await db.runAtomically([{ sql: "DROP TRIGGER fail_stamp" }]);
  assert.equal(await store.cut(input), 1);
  const [segment] = await segments(db);
  const stamped = await db.query("SELECT DISTINCT segment_event_id AS id FROM track_point");
  assert.deepEqual(
    stamped.map((row) => row.id),
    [segment?.id],
  );
});

void test("a late cut after the local close keeps in-shift points and deletes later ones", async () => {
  const db = await createTestDatabase();
  const store = new TrackStore(db);
  await insertShiftEvent(db, "shift.open", T0);
  await store.append(OWNER, SHIFT, [north(0, T0 + 1000), north(80, T0 + 16_000)]);
  await insertShiftEvent(db, "shift.close", T0 + 20_000);
  await store.append(OWNER, SHIFT, [north(160, T0 + 40_000)]);
  const count = await store.cut({
    owner: OWNER,
    rules: RULES,
    uuid: () => crypto.randomUUID(),
    now: () => T0 + 50_000,
    versions: { rules: "r1", catalog: "c1" },
  });
  assert.equal(count, 1);
  assert.equal((await segments(db))[0]?.payload.positions.length, 2);
  assert.equal((await db.query("SELECT 1 FROM track_point")).length, 2);
});

void test("pruning never deletes unsent points or points newer than 30 days", async () => {
  const db = await createTestDatabase();
  const store = new TrackStore(db);
  const now = T0 + LOCAL_RETENTION_MS + 60_000;
  await insertShiftEvent(db, "shift.open", T0);
  const cut = (owner: string) =>
    store.cut({
      owner,
      rules: RULES,
      uuid: () => crypto.randomUUID(),
      now: () => T0,
      versions: { rules: "r1", catalog: "c1" },
    });
  await store.append("sent-old", SHIFT, [north(0, T0)]);
  await store.append("pending-old", SHIFT, [north(0, T0)]);
  await store.append("sent-new", SHIFT, [north(0, now - 1000)]);
  for (const owner of ["sent-old", "pending-old", "sent-new"]) await cut(owner);
  await store.append("unsent-old", SHIFT, [north(0, T0)]);
  await db.runAtomically([
    {
      sql: `UPDATE outbox_event SET local_status='sent' WHERE id IN (SELECT segment_event_id
        FROM track_point WHERE owner_user_id IN ('sent-old','sent-new'))`,
    },
  ]);
  await store.prune(now);
  const left = await db.query("SELECT owner_user_id FROM track_point ORDER BY owner_user_id");
  assert.deepEqual(
    left.map((row) => row.owner_user_id),
    ["pending-old", "sent-new", "unsent-old"],
  );
});
