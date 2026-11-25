import assert from "node:assert/strict";
import { test } from "node:test";

import type { SqlExecutor } from "../src/db/sql.ts";
import { LOCAL_RETENTION_MS, TrackStore } from "../src/features/track/track-store.ts";
import { TrackRecorder } from "../src/features/track/track-recorder.ts";
import { readTrackRules } from "../src/features/track/track-rules.ts";
import { createTestDatabase } from "./support/sqlite-executor.ts";

const ZONE = "America/Merida"; // UTC-6, no DST
const OWNER = "owner-a";
const SHIFT_A = "11111111-1111-4111-8111-111111111111";
const SHIFT_B = "22222222-2222-4222-8222-222222222222";
const fix = (iso: string, lat = 21) => ({ at: Date.parse(iso), lat, lng: -89.6, accuracyM: 10 });

function recorder(db: SqlExecutor, owner: string | null = OWNER) {
  const unused = () => Promise.reject(new Error("not used by linesForDay"));
  return new TrackRecorder({
    store: new TrackStore(db),
    native: { prepare: unused, start: unused, stop: unused, isRunning: unused },
    identity: () => owner,
    timeZone: () => ZONE,
    rules: () => Promise.resolve(readTrackRules(null)),
    texts: unused,
    versions: () => Promise.resolve({ rules: "r1", catalog: "c1" }),
    uuid: () => crypto.randomUUID(),
    now: () => Date.parse("2026-11-21T12:00:00Z"),
    requestSync: () => undefined,
    report: () => undefined,
  });
}

void test("P33b two shifts on one local day give two separate lines", async () => {
  const db = await createTestDatabase();
  const store = new TrackStore(db);
  await store.append(OWNER, SHIFT_A, [
    fix("2026-11-20T14:00:00Z", 21),
    fix("2026-11-20T14:05:00Z", 21.001),
  ]);
  await store.append(OWNER, SHIFT_B, [fix("2026-11-20T20:00:00Z", 21.01)]);

  const lines = await recorder(db).linesForDay("2026-11-20", ZONE);

  assert.deepEqual(lines, [
    [
      [-89.6, 21],
      [-89.6, 21.001],
    ],
    [[-89.6, 21.01]],
  ]);
});

void test("P33b a point at 23:50 local stays on its local day across the UTC boundary", async () => {
  const db = await createTestDatabase();
  // 23:50 in Merida on Nov 20 is 05:50 UTC on Nov 21; 00:10 local on Nov 21 is 06:10 UTC.
  await new TrackStore(db).append(OWNER, SHIFT_A, [
    fix("2026-11-21T05:50:00Z", 21),
    fix("2026-11-21T06:10:00Z", 22),
  ]);

  assert.deepEqual(await recorder(db).linesForDay("2026-11-20", ZONE), [[[-89.6, 21]]]);
  assert.deepEqual(await recorder(db).linesForDay("2026-11-21", ZONE), [[[-89.6, 22]]]);
});

void test("P33b another owner's points never appear in the day lines", async () => {
  const db = await createTestDatabase();
  await new TrackStore(db).append("owner-b", SHIFT_A, [fix("2026-11-20T15:00:00Z")]);

  assert.deepEqual(await recorder(db).linesForDay("2026-11-20", ZONE), []);
  assert.deepEqual(await recorder(db, null).linesForDay("2026-11-20", ZONE), []);
});

void test("P33b a day whose points were pruned gives no lines", async () => {
  const db = await createTestDatabase();
  const store = new TrackStore(db);
  const recordedAt = Date.parse("2026-10-01T15:00:00Z");
  await store.append(OWNER, SHIFT_A, [fix("2026-10-01T15:00:00Z")]);
  await store.cut({
    owner: OWNER,
    rules: readTrackRules(null),
    uuid: () => crypto.randomUUID(),
    now: () => recordedAt,
    versions: { rules: "r1", catalog: "c1" },
  });
  await db.runAtomically([
    { sql: "UPDATE outbox_event SET local_status='sent' WHERE type='track.segment'" },
  ]);
  assert.equal((await recorder(db).linesForDay("2026-10-01", ZONE)).length, 1);

  await store.prune(recordedAt + LOCAL_RETENTION_MS + 1);

  assert.deepEqual(await recorder(db).linesForDay("2026-10-01", ZONE), []);
});
