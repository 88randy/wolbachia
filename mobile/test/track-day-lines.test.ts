import assert from "node:assert/strict";
import { test } from "node:test";

import type { SqlExecutor } from "../src/db/sql.ts";
import { TrackStore } from "../src/features/track/track-store.ts";
import { TrackRecorder } from "../src/features/track/track-recorder.ts";
import { readTrackRules } from "../src/features/track/track-rules.ts";
import { createTestDatabase } from "./support/sqlite-executor.ts";

const ZONE = "America/Merida"; // UTC-6, no DST
const OWNER = "owner-a";
const SHIFT_A = "11111111-1111-4111-8111-111111111111";
const SHIFT_B = "22222222-2222-4222-8222-222222222222";
const fix = (iso: string, lat = 21) => ({ at: Date.parse(iso), lat, lng: -89.6, accuracyM: 10 });

function recorder(db: SqlExecutor, session: { owner: string | null; isUnlocked: boolean }) {
  const unused = () => Promise.reject(new Error("not used by linesForDay"));
  return new TrackRecorder({
    store: new TrackStore(db),
    native: { prepare: unused, start: unused, stop: unused, isRunning: unused },
    identity: () => session.owner,
    isUnlocked: () => session.isUnlocked,
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
const unlocked = () => ({ owner: OWNER as string | null, isUnlocked: true });

void test("P33b two shifts on one local day give two lines; a single fix draws no line", async () => {
  const db = await createTestDatabase();
  const store = new TrackStore(db);
  await store.append(OWNER, SHIFT_A, [
    fix("2026-11-20T14:00:00Z"),
    fix("2026-11-20T14:05:00Z", 22),
  ]);
  await store.append(OWNER, SHIFT_B, [
    fix("2026-11-20T20:00:00Z"),
    fix("2026-11-20T20:05:00Z", 23),
  ]);
  await store.append(OWNER, "33333333-3333-4333-8333-333333333333", [fix("2026-11-20T22:00:00Z")]);

  const lines = await recorder(db, unlocked()).linesForDay("2026-11-20", ZONE);

  assert.deepEqual(lines, [
    [
      [-89.6, 21],
      [-89.6, 22],
    ],
    [
      [-89.6, 21],
      [-89.6, 23],
    ],
  ]);
});

void test("P33b a point at 23:50 local stays on its local day across the UTC boundary", async () => {
  const db = await createTestDatabase();
  // 23:40 and 23:50 in Merida on Nov 20 are 05:40/05:50 UTC on Nov 21; 06:10 UTC is Nov 21 local.
  await new TrackStore(db).append(OWNER, SHIFT_A, [
    fix("2026-11-21T05:40:00Z", 20),
    fix("2026-11-21T05:50:00Z", 21),
    fix("2026-11-21T06:10:00Z", 22),
    fix("2026-11-21T06:20:00Z", 23),
  ]);
  const track = recorder(db, unlocked());

  assert.deepEqual(await track.linesForDay("2026-11-20", ZONE), [
    [
      [-89.6, 20],
      [-89.6, 21],
    ],
  ]);
  assert.deepEqual(await track.linesForDay("2026-11-21", ZONE), [
    [
      [-89.6, 22],
      [-89.6, 23],
    ],
  ]);
});

void test("P33b another owner's points, a locked phone or a lock during the read give no lines", async () => {
  const db = await createTestDatabase();
  const store = new TrackStore(db);
  const points = [fix("2026-11-20T15:00:00Z"), fix("2026-11-20T15:05:00Z", 22)];
  await store.append("owner-b", SHIFT_A, points);
  await store.append(OWNER, SHIFT_B, points);
  const session = unlocked();
  const track = recorder(db, session);
  assert.equal((await track.linesForDay("2026-11-20", ZONE)).length, 1, "owner-b excluded");

  session.isUnlocked = false;
  assert.deepEqual(await track.linesForDay("2026-11-20", ZONE), []);

  session.isUnlocked = true;
  const reading = track.linesForDay("2026-11-20", ZONE);
  session.owner = "owner-b"; // changes before the awaited query resolves
  assert.deepEqual(await reading, []);
});
