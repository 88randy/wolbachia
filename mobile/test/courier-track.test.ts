import assert from "node:assert/strict";
import { test } from "node:test";

import type { SqlExecutor } from "../src/db/sql.ts";
import { eventInsertStatement } from "../src/outbox/outbox-repository.ts";
import { simplifyTrack, metersBetween } from "../src/features/track/simplify-track.ts";
import type { TrackFix } from "../src/features/track/simplify-track.ts";
import { keepFix } from "../src/features/track/track-filter.ts";
import type { RawFix } from "../src/features/track/track-filter.ts";
import { dayEndAfter } from "../src/features/track/day-end.ts";
import {
  IDLE_CUT_MS,
  reconcileOnChange,
  TrackRecorder,
} from "../src/features/track/track-recorder.ts";
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

type ShiftEvent = "shift.open" | "shift.close";
const shiftEventsOf = (shiftId: string) => (db: SqlExecutor, type: ShiftEvent, at: number) =>
  db.runAtomically([
    eventInsertStatement(
      {
        id: crypto.randomUUID(),
        type,
        schema_version: 1,
        device_time: new Date(at).toISOString(),
        shift_id: shiftId,
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
const insertShiftEvent = shiftEventsOf(SHIFT);

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
function fixture(
  db: SqlExecutor,
  options: { isLocationGranted?: boolean; store?: TrackStore; startGate?: Deferred } = {},
) {
  const calls: string[] = [];
  const starts: TrackStartOptions[] = [];
  const state = { running: false, owner: OWNER as string | null, now: T0, startError: false };
  const native: NativeTrackApi = {
    prepare: () =>
      Promise.resolve({
        isLocationGranted: options.isLocationGranted ?? true,
        isNotificationGranted: true,
      }),
    start: async (startOptions) => {
      calls.push("start");
      if (options.startGate) {
        options.startGate.entered.resolve();
        await options.startGate.release.promise;
      }
      if (state.startError) throw new Error("ForegroundServiceStartNotAllowed");
      starts.push(startOptions);
      state.running = true;
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
    store: options.store ?? new TrackStore(db),
    native,
    identity: () => state.owner,
    isUnlocked: () => true,
    timeZone: () => "America/Merida",
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

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
/** A barrier: `entered` resolves when the blocked call starts, `release` lets it finish. */
interface Deferred {
  readonly entered: ReturnType<typeof deferred>;
  readonly release: ReturnType<typeof deferred>;
}
const barrier = (): Deferred => ({ entered: deferred(), release: deferred() });

/** A real store whose next append waits on a barrier. */
class BlockingStore extends TrackStore {
  readonly gate = barrier();
  override async append(owner: string, shiftId: string, fixes: readonly TrackFix[]) {
    this.gate.entered.resolve();
    await this.gate.release.promise;
    await super.append(owner, shiftId, fixes);
  }
}

const unsentOf = async (db: SqlExecutor, owner: string) =>
  (
    await db.query("SELECT 1 FROM track_point WHERE owner_user_id=? AND segment_event_id IS NULL", [
      owner,
    ])
  ).length;

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

void test("a deferred batch delivered after the close keeps its fixes up to the close", async () => {
  const db = await createTestDatabase();
  const { recorder } = fixture(db);
  await insertShiftEvent(db, "shift.open", T0);
  await recorder.reconcile();
  await recorder.onFixes([raw(north(0, T0 + 1000))]);
  await insertShiftEvent(db, "shift.close", T0 + 20_000);
  await recorder.reconcile(); // local close: first cut and stop
  await recorder.onFixes([raw(north(80, T0 + 18_000)), raw(north(160, T0 + 25_000))]);
  const points = await db.query("SELECT recorded_at FROM track_point ORDER BY recorded_at");
  assert.deepEqual(
    points.map((row) => row.recorded_at),
    [T0 + 1000, T0 + 18_000],
    "the fix after the close is never stored",
  );
  assert.equal(await unsentOf(db, OWNER), 0, "the late fix was cut at once");
  assert.deepEqual(
    (await segments(db)).map((segment) => segment.payload.positions.length),
    [1, 1],
  );
});

void test("close, logout or revocation queued behind a blocked append leaves nothing unsent", async () => {
  const db = await createTestDatabase();
  const store = new BlockingStore(db);
  const { recorder, calls, state } = fixture(db, { store });
  await insertShiftEvent(db, "shift.open", T0);
  await recorder.reconcile();
  const fixes = recorder.onFixes([raw(north(0, T0 + 1000)), raw(north(80, T0 + 16_000))]);
  await store.gate.entered.promise; // the batch passed its shift and owner checks
  await insertShiftEvent(db, "shift.close", T0 + 20_000);
  const close = recorder.reconcile();
  state.owner = null; // logout or remote revocation, queued behind the append
  const logout = recorder.reconcile();
  store.gate.release.resolve();
  await Promise.all([fixes, close, logout]);
  assert.equal(await unsentOf(db, OWNER), 0, "the departed owner's points were all cut");
  assert.equal((await segments(db)).length, 1);
  assert.deepEqual(calls, ["start", "stop"]);
  assert.equal(state.running, false);
});

void test("a stop queued behind a blocked start runs after it, never the other way round", async () => {
  const db = await createTestDatabase();
  const startGate = barrier();
  const { recorder, calls, state } = fixture(db, { startGate });
  await insertShiftEvent(db, "shift.open", T0);
  const opening = recorder.reconcile();
  await startGate.entered.promise;
  state.owner = null;
  const revoked = recorder.reconcile();
  startGate.release.resolve();
  await Promise.all([opening, revoked]);
  assert.deepEqual(calls, ["start", "stop"]);
  assert.equal(state.running, false);
});

void test("an open shift tracked by one owner is never tracked by another", async () => {
  const db = await createTestDatabase();
  const { recorder, calls, state } = fixture(db);
  await insertShiftEvent(db, "shift.open", T0);
  await recorder.reconcile();
  state.owner = "owner-b";
  await recorder.reconcile();
  await recorder.onFixes([raw(north(0, T0 + 1000))]);
  assert.deepEqual(calls, ["start", "stop"]);
  assert.equal((await db.query("SELECT 1 FROM track_point")).length, 0);
  state.owner = OWNER;
  await recorder.reconcile();
  assert.deepEqual(calls, ["start", "stop", "start"], "the claiming owner resumes");
});

void test("unlock, late profile hydration and logout each reconcile once", () => {
  const listeners = new Set<() => void>();
  let key = "locked|";
  let reconciles = 0;
  reconcileOnChange({
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    key: () => key,
    reconcile: () => {
      reconciles += 1;
      return Promise.resolve();
    },
  });
  const emit = (next: string) => {
    key = next;
    for (const listener of listeners) listener();
  };
  emit("locked|"); // unrelated auth change (clock skew, connectivity)
  emit("locked|owner-a"); // cold start: profile hydrated
  emit("unlocked|owner-a");
  emit("unlocked|owner-a");
  emit("login|");
  assert.equal(reconciles, 3);
});

void test("the day end is the first local day end after the opening, in the organization zone", () => {
  const at = (iso: string) => Date.parse(iso);
  // Mérida is UTC-6 all year: opened 08:00, ends 20:00 local the same day.
  assert.equal(
    dayEndAfter(at("2026-11-24T14:00:00Z"), 1200, "America/Merida"),
    at("2026-11-25T02:00:00Z"),
  );
  // Opened at 21:00 local, after the day end: it runs until 20:00 the next day.
  assert.equal(
    dayEndAfter(at("2026-11-25T03:00:00Z"), 1200, "America/Merida"),
    at("2026-11-26T02:00:00Z"),
  );
  // Opened 00:00 EST on the DST switch day: 20:00 EDT is UTC-4, not UTC-5.
  assert.equal(
    dayEndAfter(at("2026-03-08T05:00:00Z"), 1200, "America/New_York"),
    at("2026-03-09T00:00:00Z"),
  );
});

void test("an open shift stops recording at its day end, flushes and never restarts that shift", async () => {
  const db = await createTestDatabase();
  const { recorder, calls, state } = fixture(db);
  const dayEnd = Date.parse("2026-11-25T02:00:00Z"); // 20:00 in Mérida for the T0 opening
  await insertShiftEvent(db, "shift.open", T0);
  await recorder.reconcile();
  await recorder.onFixes([raw(north(0, T0 + 1000))]);
  // The batch that crosses the day end: the fix before it is kept, the one after is dropped.
  state.now = dayEnd + 60_000;
  await recorder.onFixes([raw(north(500, dayEnd - 30_000)), raw(north(900, dayEnd + 30_000))]);
  assert.deepEqual(calls, ["start", "stop"]);
  assert.equal(recorder.getSnapshot().notice, "dayEnded");
  assert.equal(await unsentOf(db, OWNER), 0, "the last segment was flushed before stopping");
  assert.deepEqual(
    (await db.query("SELECT recorded_at FROM track_point ORDER BY recorded_at")).map(
      (row) => row.recorded_at,
    ),
    [T0 + 1000, dayEnd - 30_000],
  );
  state.now = dayEnd + 2 * 60_000;
  await recorder.reconcile(); // foreground, still the same day
  state.now = dayEnd + 12 * 60 * 60_000;
  await recorder.reconcile(); // next morning, the same shift was never closed
  assert.deepEqual(calls, ["start", "stop"], "the open shift is not recorded again");
  assert.equal(recorder.getSnapshot().notice, "dayEnded");

  const next = "22222222-2222-4222-8222-222222222222";
  await insertShiftEvent(db, "shift.close", state.now);
  await shiftEventsOf(next)(db, "shift.open", state.now + 1000);
  state.now += 2000;
  await recorder.reconcile();
  assert.deepEqual(calls, ["start", "stop", "start"], "a shift opened afterwards records");
  assert.equal(recorder.getSnapshot().notice, null);
});

void test("a still phone sends one segment per idle hour instead of one per upload interval", async () => {
  const db = await createTestDatabase();
  const { recorder, state } = fixture(db);
  await insertShiftEvent(db, "shift.open", T0);
  await recorder.reconcile();
  // One heartbeat every 300 s at the same spot, delivered as it comes (13 fixes = 1 hour).
  for (let beat = 0; beat <= 12; beat += 1) {
    const at = T0 + 1000 + beat * 300_000;
    state.now = at;
    await recorder.onFixes([raw(north(0, at, 8))]);
    if (state.now - (T0 + 1000) < IDLE_CUT_MS)
      assert.equal((await segments(db)).length, 0, `nothing cut after ${String(beat)} heartbeats`);
  }
  const cut = await segments(db);
  assert.deepEqual(
    cut.map((segment) => segment.payload.positions.length),
    [13],
  );
  assert.equal(await unsentOf(db, OWNER), 0);
});

void test("after 30 days final segments are compacted; the envelope stays immutable otherwise", async () => {
  const db = await createTestDatabase();
  const store = new TrackStore(db);
  await insertShiftEvent(db, "shift.open", T0);
  const input = {
    owner: OWNER,
    rules: RULES,
    uuid: () => crypto.randomUUID(),
    now: () => T0,
    versions: { rules: "r1", catalog: "c1" },
  };
  await store.append(OWNER, SHIFT, [north(0, T0 + 1000)]);
  await store.cut(input);
  await store.append(OWNER, SHIFT, [north(80, T0 + 16_000)]);
  await store.cut(input);
  const [sentId, pendingId] = (await segments(db)).map((segment) => segment.id);
  const update = (sql: string, id: unknown) => db.runAtomically([{ sql, params: [String(id)] }]);
  await update("UPDATE outbox_event SET local_status='sent' WHERE id=?", sentId);
  await store.prune(T0 + LOCAL_RETENTION_MS - 60_000);
  const before = await segments(db);
  assert.equal(before[0]?.payload.positions.length, 1, "not yet 30 days old");
  await store.prune(T0 + LOCAL_RETENTION_MS + 60_000);
  const [compacted, kept] = (await segments(db)).map((segment) => segment.payload);
  assert.deepEqual(compacted, {
    started_at: new Date(T0 + 1000).toISOString(),
    positions: [],
    compacted: true,
  });
  assert.equal(kept?.positions.length, 1, "a pending segment keeps its positions");
  const immutable = /the event envelope never changes/;
  await assert.rejects(
    update("UPDATE outbox_event SET payload='{}' WHERE id=?", sentId),
    immutable,
  );
  await assert.rejects(
    update(
      `UPDATE outbox_event SET payload=json_set(payload,'$.positions',json('[]'),'$.compacted',json('true'))
        WHERE id=?`,
      pendingId,
    ),
    immutable,
    "a pending segment cannot be compacted",
  );
  await assert.rejects(
    update("UPDATE outbox_event SET shift_id='x' WHERE id=?", sentId),
    immutable,
  );
});
