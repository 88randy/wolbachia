import assert from "node:assert/strict";
import { test } from "node:test";
import type { Schemas } from "@wolbachia/api-client";
import { DayStore } from "../src/features/day/store.ts";
import { DayService } from "../src/features/day/service.ts";
import { DayBundleService } from "../src/features/day/bundle-service.ts";
import type { BundleResult } from "../src/features/day/bundle-service.ts";
import { ShiftOpenStore } from "../src/features/shift-open/store.ts";
import { UNAVAILABLE_MAP } from "../src/features/shift-open/domain.ts";
import { NavigationService } from "../src/navigation/navigation-service.ts";
import { buildDay, mapTasks } from "../src/features/day/domain.ts";
import { createStores, FIXED_NOW, makeEnvelope } from "./support/factories.ts";
import type { TestStores } from "./support/factories.ts";
import { hasLocalRecords } from "../src/db/owner-data.ts";
import { migrate, SCHEMA_VERSION } from "../src/db/migrations.ts";
import { parseBundle } from "../src/features/day/bundle-parser.ts";
import { upsertTask } from "../src/features/day/projection-statements.ts";
import { setStatement } from "../src/db/kv-store.ts";
const TASK_ID = "11111111-1111-4111-8111-111111111111";
const POINT_ID = "22222222-2222-4222-8222-222222222222";
const QUADRANT_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_ID = "44444444-4444-4444-8444-444444444444";
const task = () => ({
  id: TASK_ID,
  kind: "task",
  code: "OV-1:check:2026-01-15",
  point: POINT_ID,
  quadrant_id: QUADRANT_ID,
  courier: "55555555-5555-4555-8555-555555555555",
  revision: 1,
  action: "check",
  date: "2026-01-15",
  category: "high",
  source: null,
  protocol: null,
  target: 1,
});
const point = (
  patch: Partial<Schemas["SamplingPointBundle"]> = {},
): Schemas["SamplingPointBundle"] => ({
  id: POINT_ID,
  code: "OV-1",
  block_id: OTHER_ID,
  quadrant_id: QUADRANT_ID,
  location: [-99.1, 19.4],
  is_retired: false,
  version: 1,
  ...patch,
});
const bundle = (
  samplingPoints: readonly unknown[],
  assignments: readonly unknown[] = [task()],
) => ({
  bundle_version: "bundle-1",
  schema_version: "schema-1",
  scope_revision: "scope-1",
  cursor: "points-cursor",
  next_change_at: null,
  map_manifest_ready: false,
  assignments,
  map_manifests: [],
  sampling_points: samplingPoints,
});
async function locationFixture(existing?: TestStores) {
  const stores = existing ?? (await createStores());
  const store = new DayStore(stores.db);
  const bundleService = new DayBundleService({
    store,
    now: () => FIXED_NOW,
    transport: () => Promise.reject(new Error("No network is needed for local locations")),
  });
  const launched: string[] = [];
  const day = new DayService({
    bundle: bundleService,
    kv: stores.kv,
    shift: new ShiftOpenStore(stores.db),
    work: { read: () => Promise.resolve([]) },
    hasOpenShift: () => Promise.resolve(true),
    location: { start: () => Promise.resolve(() => undefined) },
    maps: { prepare: () => Promise.resolve(UNAVAILABLE_MAP) },
    inspect: (asset) => Promise.resolve({ sha256: asset.sha256 ?? "", size: asset.size }),
    navigation: new NavigationService({
      kv: stores.kv,
      now: () => FIXED_NOW,
      launcher: {
        launch: (uri) => {
          launched.push(uri);
          return Promise.resolve("launched");
        },
      },
    }),
  });
  return { ...stores, store, bundleService, day, launched };
}
async function markers(h: Awaited<ReturnType<typeof locationFixture>>) {
  const state = await h.day.read();
  return mapTasks(
    buildDay({ tasks: state.tasks, work: [], location: { kind: "denied" }, now: FIXED_NOW }).tasks,
  );
}
void test("task locations: real assignments v2 join SamplingPointBundle by UUID for markers and directions", async () => {
  const h = await locationFixture();
  await h.store.replace(bundle([point()]), FIXED_NOW);
  const located = await markers(h);
  assert.equal(located.length, 1);
  assert.equal(located[0]?.task.lat, 19.4);
  assert.equal(located[0].task.lng, -99.1);
  assert.equal((await h.day.navigate(TASK_ID)).outcome, "launched");
  assert.equal(h.launched.length, 1);
  assert.ok(h.launched[0]?.startsWith("geo:19.400000,-99.100000?"));
});

void test("task locations: missing, retired, malformed and foreign-quadrant points never use code or inline GPS", async () => {
  const cases: readonly (readonly unknown[])[] = [
    [],
    [point({ is_retired: true })],
    [point({ location: [200, 19] })],
    [point({ location: [-99, Number.NaN] })],
    [point({ id: OTHER_ID })],
    [point({ quadrant_id: OTHER_ID })],
    [point({ block_id: "not-a-uuid" })],
    [point(), point({ location: [-100, 20] })],
  ];
  for (const points of cases) {
    const h = await locationFixture();
    await h.store.replace(bundle(points, [{ ...task(), lat: 88, lng: 179 }]), FIXED_NOW);
    assert.equal((await h.store.read()).tasks.length, 1);
    assert.equal((await markers(h)).length, 0);
    assert.equal((await h.day.navigate(TASK_ID)).outcome, "invalid_coordinates");
    assert.deepEqual(h.launched, []);
  }
});
function pointChange(
  sequence: number,
  data: unknown,
  options: { readonly action?: "upsert" | "remove"; readonly version?: number } = {},
) {
  return {
    sampling_points: [
      {
        sequence,
        action: options.action ?? "upsert",
        resource_type: "sampling_point",
        resource_id: POINT_ID,
        resource_version: String(options.version ?? sequence),
        data,
      },
    ],
  };
}
import { mkdtempSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openTestDatabase } from "./support/sqlite-executor.ts";
import { KvStore } from "../src/db/kv-store.ts";
import { OutboxRepository } from "../src/outbox/outbox-repository.ts";
import type { SqlExecutor } from "../src/db/sql.ts";
const storesFor = (db: SqlExecutor): TestStores => ({
  db,
  kv: new KvStore(db),
  outbox: new OutboxRepository(db, () => FIXED_NOW),
});
void test("task locations: current point deltas survive reopen and scope replacement removes GPS from retained work", async () => {
  const output = join(dirname(fileURLToPath(import.meta.url)), "../dist");
  mkdirSync(output, { recursive: true });
  const root = realpathSync(output);
  const directory = mkdtempSync(join(root, "task-locations-"));
  const path = join(directory, "phone.db");
  let phone = await openTestDatabase(path);
  try {
    let h = await locationFixture(storesFor(phone.executor));
    await h.store.replace(bundle([point()], [{ ...task(), lat: 88, lng: 179 }]), FIXED_NOW);
    const evidence = makeEnvelope({ payload: { task_id: TASK_ID } });
    await h.outbox.enqueue(evidence);
    await h.store.applyChanges(pointChange(2, point({ version: 2, location: [-100, 20] })));
    phone.close();
    phone = await openTestDatabase(path);
    h = await locationFixture(storesFor(phone.executor));
    assert.equal((await markers(h))[0]?.task.lat, 20);
    await h.store.applyChanges(pointChange(3, point({ version: 3, is_retired: true })));
    await h.store.applyChanges(pointChange(2, point({ version: 2 })));
    await h.store.applyChanges(pointChange(4, point({ version: 1 }), { version: 1 }));
    await h.store.applyChanges(pointChange(4, point({ version: 3 }), { version: 3 }));
    assert.equal((await markers(h)).length, 0);
    await h.store.applyChanges(pointChange(5, point({ version: 5 })));
    assert.equal((await markers(h)).length, 1);
    await h.store.applyChanges(pointChange(6, point({ version: 6, location: [] })));
    assert.equal((await markers(h)).length, 0);
    await h.store.applyChanges(pointChange(7, point({ version: 7 })));
    await h.store.applyChanges(pointChange(8, {}, { action: "remove" }));
    assert.equal((await markers(h)).length, 0);
    await h.store.applyChanges(pointChange(9, point({ version: 9 })));
    assert.equal((await markers(h)).length, 1);
    await h.store.replace(bundle([], []), FIXED_NOW);
    const retained = (await h.store.read()).tasks[0];
    assert.equal(retained?.isKept, true);
    assert.equal(retained.task.lat, undefined);
    assert.equal(retained.task.lng, undefined);
    assert.equal((await markers(h)).length, 0);
    assert.equal((await h.day.navigate(TASK_ID)).outcome, "invalid_coordinates");
    await h.bundleService.clearSessionData();
    assert.equal((await h.db.query("SELECT id FROM day_sampling_point")).length, 0);
    assert.equal((await h.day.read()).tasks.length, 0);
    assert.equal((await h.outbox.claimPending(10))[0]?.envelope.id, evidence.id);
  } finally {
    phone.close();
    assert.equal(dirname(realpathSync(directory)), root);
    rmSync(directory, { recursive: true });
  }
});
void test("task locations: point-only downloads remain cache and a failed replacement cannot partially change GPS or cursor", async () => {
  const h = await locationFixture();
  await h.store.replace(bundle([point()], []), FIXED_NOW);
  assert.equal(await hasLocalRecords(h.db), false); // M3: downloaded point cache is not authored owner work.
  await h.store.replace(bundle([point()]), FIXED_NOW);
  await h.db.query(
    "CREATE TRIGGER fail_point_write BEFORE INSERT ON day_sampling_point BEGIN SELECT RAISE(ABORT,'storage unavailable'); END",
  );
  await assert.rejects(
    h.store.replace(
      { ...bundle([point({ version: 2, location: [-100, 20] })]), cursor: "must-not-commit" },
      FIXED_NOW,
    ),
  );
  assert.equal((await markers(h))[0]?.task.lat, 19.4);
  assert.equal(await h.kv.get("sync_cursor"), "points-cursor");
  await h.db.query("DROP TRIGGER fail_point_write");
  await h.bundleService.clearSessionData();
  assert.equal(await hasLocalRecords(h.db), false);
});

void test("task locations: schema 8 upgrade keeps normal refresh unconditional through 304, offline, rollback and reopen until bootstrap succeeds", async () => {
  const output = join(dirname(fileURLToPath(import.meta.url)), "../dist");
  mkdirSync(output, { recursive: true });
  const root = realpathSync(output);
  const directory = mkdtempSync(join(root, "task-location-upgrade-"));
  const path = join(directory, "phone.db");
  let phone = await openTestDatabase(path, 8);
  const etags: (string | null)[] = [];
  let answer: BundleResult | Error = { kind: "unchanged" };
  const recoveryService = (store: DayStore) =>
    new DayBundleService({
      store,
      now: () => FIXED_NOW,
      transport: (etag) => {
        etags.push(etag);
        return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
      },
    });
  try {
    let h = await locationFixture(storesFor(phone.executor));
    const legacy = parseBundle(
      { ...bundle([]), bundle_version: "unchanged-server-etag", cursor: "valid-existing-cursor" },
      FIXED_NOW,
    );
    const legacyTask = legacy.tasks[0];
    assert.ok(legacyTask);
    await h.db.runAtomically([
      upsertTask(legacyTask),
      {
        sql: "INSERT INTO day_bundle_meta(slot,payload) VALUES(1,?)",
        params: [JSON.stringify(legacy.meta)],
      },
      setStatement("sync_cursor", legacy.cursor),
    ]);
    const evidence = makeEnvelope({ payload: { task_id: TASK_ID } });
    await h.outbox.enqueue(evidence);
    await migrate(h.db);
    assert.equal((await h.db.query("PRAGMA user_version"))[0]?.user_version, SCHEMA_VERSION);
    assert.equal((await h.store.read()).tasks[0]?.task.id, TASK_ID);
    let service = recoveryService(h.store);
    await assert.rejects(service.refresh(), /requires a body/);
    assert.deepEqual(etags, [null]);
    answer = new Error("airplane");
    await assert.rejects(service.refresh(), /airplane/);
    answer = { kind: "bundle", body: bundle([point()]) };
    await h.db.query(
      "CREATE TRIGGER fail_upgrade_cursor BEFORE INSERT ON kv WHEN NEW.key='sync_cursor' BEGIN SELECT RAISE(ABORT,'storage unavailable'); END",
    );
    await assert.rejects(service.refresh(), /storage unavailable/);
    await h.db.query("DROP TRIGGER fail_upgrade_cursor");
    assert.equal(await h.kv.get("sync_cursor"), "valid-existing-cursor");
    assert.equal((await markers(h)).length, 0);
    phone.close();
    phone = await openTestDatabase(path);
    h = await locationFixture(storesFor(phone.executor));
    service = recoveryService(h.store);
    answer = { kind: "unchanged" };
    await assert.rejects(service.refresh(), /requires a body/);
    answer = { kind: "bundle", body: bundle([point()]) };
    await service.refresh();
    assert.equal((await markers(h)).length, 1);
    assert.equal(await h.kv.get("sync_cursor"), "points-cursor");
    assert.equal((await h.outbox.claimPending(1))[0]?.envelope.id, evidence.id);
    answer = { kind: "unchanged" };
    await service.refresh();
    assert.deepEqual(etags, [null, null, null, null, null, "bundle-1"]);
    await h.store.replace(bundle([]), FIXED_NOW);
    await service.refresh();
    assert.equal(etags.at(-1), "bundle-1");
    assert.equal((await markers(h)).length, 0);
  } finally {
    phone.close();
    assert.equal(dirname(realpathSync(directory)), root);
    rmSync(directory, { recursive: true });
  }
});
