import { DayViewController, dayViewPhase } from "../src/features/day/day-view-controller.ts";
import { AuthController } from "../src/auth/auth-controller.ts";
import { randomBytes, randomUUID } from "node:crypto";
import { locationMessage } from "../src/features/day/location-presentation.ts";
import { scheduleDueRefresh } from "../src/features/day/due-refresh.ts";
import { createScopedSyncTransport } from "../src/sync/scoped-sync-transport.ts";
import { createLinkingLauncher } from "../src/navigation/linking-launcher.ts";
import { DayService } from "../src/features/day/service.ts";
import { ShiftOpenStore } from "../src/features/shift-open/store.ts";
import { refreshDay } from "../src/features/day/refresh-day.ts";
import { createScopedApiClient } from "../src/api/create-scoped-api-client.ts";
import { createMobileApiClient } from "../src/api/create-api-client.ts";
import { createMemoryTokenStore } from "./support/token-store.ts";
import { SessionRequests } from "../src/auth/session-requests.ts";
import { makeCredentials } from "./support/auth-fakes.ts";
import { createSyncTransport } from "../src/sync/sync-transport.ts";
import { createBootstrapTransport } from "../src/features/day/bootstrap-transport.ts";
import { OutboxWorkOverlay } from "../src/features/day/local-work.ts";
import type { SyncCallResult } from "../src/sync/sync-transport.ts";
import { KV_KEYS } from "../src/db/kv-store.ts";
import { runSyncPass } from "../src/sync/sync-pass.ts";
import { accepted, answer, httpFailure, scriptedTransport } from "./support/scripted-transport.ts";
import { FIXED_DEVICE_ID } from "./support/factories.ts";
import type { LocationState } from "../src/features/day/location.ts";
import type { MapPreparation } from "../src/features/shift-open/domain.ts";
import { verifyMap, hasCoverage } from "../src/features/day/map-coverage.ts";
import { hasCoordinates, parseAssignment } from "../src/features/day/assignment-parser.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { DayStore } from "../src/features/day/store.ts";
import { DayBundleService } from "../src/features/day/bundle-service.ts";
import { createDayBundle } from "../src/features/day/create-day-bundle.ts";
import { CredentialStore } from "../src/auth/credential-store.ts";
import { openTestDatabase } from "./support/sqlite-executor.ts";
import { OutboxRepository } from "../src/outbox/outbox-repository.ts";
import { KvStore } from "../src/db/kv-store.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDay, findAssignedTaskByPointCode, mapTasks } from "../src/features/day/domain.ts";
import { NavigationService } from "../src/navigation/navigation-service.ts";
import { createStores, makeEnvelope, FIXED_NOW } from "./support/factories.ts";
import { LAB_HISTORY } from "./support/lifecycle-contract-fixtures.ts";
import type { SqlExecutor } from "../src/db/sql.ts";

async function downloadedLabKinds(db: SqlExecutor) {
  const rows = await db.query(
    "SELECT kind FROM lifecycle_courier_projection WHERE kind LIKE 'history.lab_%'",
  );
  return rows.map((row) => row.kind).sort();
}

const task = (overrides: Record<string, unknown> = {}) => ({
  kind: "task",
  code: overrides.point_code ?? "OV-012",
  point: "point-1",
  courier: "courier-1",
  category: overrides.risk ?? "high",
  revision: overrides.version ?? 1,
  id: "task-1",
  point_code: "OV-012",
  action: "check",
  date: "2026-01-15",
  risk: "high",
  version: 1,
  status: "pending",
  block_code: "0123",
  quadrant_id: "q1",
  lat: 19.4,
  lng: -99.1,
  ...overrides,
});
const manifest = {
  asset_id: "q1.pmtiles",
  version: "1",
  sha256: "a".repeat(64),
  size_bytes: 127,
  quadrant_id: "q1",
  licensed: true,
};
const bundle = (assignments: unknown[] = [task()]) => ({
  bundle_version: "bundle-1",
  schema_version: "schema-1",
  scope_revision: "scope-1",
  next_change_at: null,
  map_manifest_ready: true,
  assignments,
  map_manifests: [manifest],
  cursor: "bootstrap-cursor",
});
const change = (action: "upsert" | "remove", version: number, data: unknown = {}) => ({
  sequence: version,
  action,
  resource_type: "assignments",
  resource_id: "task-1",
  resource_version: version,
  data,
});
async function setup() {
  const stores = await createStores();
  const store = new DayStore(stores.db);
  const service = new DayBundleService({
    store,
    transport: () => Promise.resolve({ kind: "bundle", body: bundle() }),
    now: () => FIXED_NOW,
  });
  return { ...stores, store, service };
}

void test("AC cold start: cached assignments, risk and manifests survive an offline service restart; malformed rows are counted", async () => {
  const { store } = await setup();
  await store.replace(
    bundle([task(), { id: "bad" }, task({ id: "normal", point_code: "OV-001", risk: "future" })]),
    FIXED_NOW,
  );
  const offline = new DayBundleService({
    store,
    transport: () => Promise.reject(new Error("airplane")),
    now: () => FIXED_NOW,
  });
  await assert.rejects(offline.refresh());
  const cached = await offline.read();
  const day = buildDay({
    tasks: cached.tasks,
    work: [],
    location: { kind: "denied" },
    now: FIXED_NOW,
  });
  assert.deepEqual(
    day.tasks.map((row) => row.task.point_code),
    ["OV-012", "OV-001"],
  );
  assert.equal(cached.meta?.unreadable_rows, 1);
  assert.equal(cached.manifests[0]?.asset_id, "q1.pmtiles");
});

void test("AC delta: removal or reassignment keeps pending work visible; old versions cannot resurrect a removal", async () => {
  const { store, outbox, db } = await setup();
  await store.replace(bundle(), FIXED_NOW);
  await outbox.enqueue(makeEnvelope({ payload: { task_id: "task-1" } }));
  await store.applyChanges({
    assignments: [change("upsert", 2, task({ version: 2, quadrant_id: "other" }))],
  });
  let cached = await store.read();
  assert.equal(cached.tasks[0]?.task.quadrant_id, "q1");
  assert.equal(cached.tasks[0].isKept, true);
  await store.applyChanges({ assignments: [change("remove", 3)] });
  await store.applyChanges({ assignments: [change("upsert", 2, task({ version: 2 }))] });
  cached = await store.read();
  assert.equal(cached.tasks[0]?.isKept, true);
  assert.equal((await db.query("SELECT id FROM outbox_event")).length, 1);
});

void test("AC storage: an interrupted bundle replacement rolls back projections and metadata", async () => {
  const { db, store } = await setup();
  await store.replace(bundle(), FIXED_NOW);
  await db.query(
    "CREATE TRIGGER fail_meta BEFORE UPDATE ON day_bundle_meta BEGIN SELECT RAISE(ABORT, 'disk full'); END",
  );
  await assert.rejects(store.replace({ ...bundle([]), bundle_version: "new" }, FIXED_NOW));
  assert.equal((await store.read()).tasks.length, 1);
  assert.equal((await store.read()).meta?.bundle_version, "bundle-1");
});

void test("AC scope: revoked download access removes projections but retains immutable unsent evidence", async () => {
  const { store, outbox, db } = await setup();
  await store.replace(bundle(), FIXED_NOW);
  const event = makeEnvelope({ payload: { task_id: "task-1" } });
  await outbox.enqueue(event);
  const service = new DayBundleService({
    store,
    now: () => FIXED_NOW,
    transport: () => Promise.resolve({ kind: "revoked" }),
  });
  await service.refresh();
  assert.equal((await store.read()).tasks.length, 0);
  assert.equal((await store.read()).manifests.length, 0);
  assert.equal((await db.query("SELECT id FROM outbox_event"))[0]?.id, event.id);
});

void test("AC navigation: present, absent, denied and invalid coordinates retain selected point across restart", async () => {
  const { kv } = await createStores();
  const navigator = new NavigationService({
    kv,
    now: () => FIXED_NOW,
    launcher: { launch: () => Promise.resolve("launched") },
  });
  assert.equal((await navigator.launch(task())).outcome, "launched");
  const restart = new NavigationService({
    kv,
    now: () => FIXED_NOW,
    launcher: { launch: () => Promise.resolve("no_handler") },
  });
  assert.equal((await restart.read())?.pointId, "task-1");
  assert.equal((await restart.launch(task())).outcome, "no_handler");
  const denied = new NavigationService({
    kv,
    now: () => FIXED_NOW,
    launcher: { launch: () => Promise.reject(new Error("lock task")) },
  });
  assert.equal((await denied.launch(task())).outcome, "denied");
  assert.equal((await denied.launch(task({ lat: NaN }))).outcome, "invalid_coordinates");
});

void test("AC sync: projection failure leaves cursor unchanged and original event recoverable", async () => {
  const stores = await createStores();
  await stores.kv.set(KV_KEYS.syncCursor, "old");
  const event = makeEnvelope({ payload: { task_id: "task-1" } });
  await stores.outbox.enqueue(event);
  const scripted = scriptedTransport([answer([accepted(event.id)], { cursor: "new" })]);
  await assert.rejects(
    runSyncPass(
      {
        ...stores,
        deviceId: FIXED_DEVICE_ID,
        now: () => FIXED_NOW,
        transport: scripted.transport,
        applyProjectionChanges: () => Promise.reject(new Error("disk full")),
      },
      { batchSize: 50 },
    ),
  );
  assert.equal(await stores.kv.get(KV_KEYS.syncCursor), "old");
  await stores.outbox.recoverInterrupted();
  assert.equal((await stores.outbox.claimPending(1))[0]?.envelope.id, event.id);
});

void test("AC restart recovery: invalid cursor bootstraps unconditionally before resending the original UUID", async () => {
  const { store, ...stores } = await setup();
  await store.replace(bundle(), FIXED_NOW);
  const event = makeEnvelope();
  await stores.outbox.enqueue(event);
  const etags: (string | null)[] = [];
  const recovery = new DayBundleService({
    store,
    now: () => FIXED_NOW,
    transport: (etag) => {
      etags.push(etag);
      return Promise.resolve({ kind: "bundle", body: { ...bundle(), cursor: "fresh" } });
    },
  });
  const scripted = scriptedTransport([
    httpFailure(400, "invalid_cursor"),
    answer([accepted(event.id)]),
  ]);
  await runSyncPass(
    {
      ...stores,
      deviceId: FIXED_DEVICE_ID,
      now: () => FIXED_NOW,
      transport: scripted.transport,
      recoverProjections: () => recovery.refresh(true),
      applyProjectionChanges: recovery.applyProjectionChanges,
    },
    { batchSize: 50 },
  );
  assert.deepEqual(etags, [null]);
  assert.equal(scripted.requests[1]?.cursor, "fresh");
  assert.deepEqual(
    scripted.requests.map((request) => request.events.map((entry) => entry.id)),
    [[event.id], [event.id]],
  );
  assert.equal((await stores.outbox.countByStatus()).sent, 1);
});

void test("AC GPS: denied, unavailable and stale fixes keep risk/code order without distances", async () => {
  const { store } = await setup();
  await store.replace(
    bundle([task(), task({ id: "b", point_code: "OV-001", risk: "normal" })]),
    FIXED_NOW,
  );
  const cache = await store.read();
  const states: LocationState[] = [
    { kind: "denied" },
    { kind: "unavailable" },
    { kind: "granted", fix: { lat: 0, lng: 0, accuracy_m: 12, fixedAt: 0 } },
  ];
  for (const location of states) {
    const day = buildDay({ tasks: cache.tasks, work: [], location, now: FIXED_NOW });
    assert.deepEqual(
      day.tasks.map((row) => row.task.point_code),
      ["OV-012", "OV-001"],
    );
    assert.ok(day.tasks.every((row) => row.distanceM === null));
  }
});

void test("AC map: ready local asset provides coverage; missing file/hash mismatch/unready offers the list", async () => {
  const preparation: MapPreparation = {
    status: "ready",
    version: "v1",
    requiredCoverage: ["q1"],
    coverage: ["q1"],
    assets: [{ id: manifest.asset_id, license: "OSM", size: 127, sha256: manifest.sha256 }],
    verifiedAssets: [
      {
        id: manifest.asset_id,
        fileRef: "file:///private/q1.pmtiles",
        size: 127,
        sha256: manifest.sha256,
      },
    ],
    progress: 1,
    error: null,
  };
  const inspect = () => Promise.resolve({ sha256: manifest.sha256, size: 127 });
  const ready = await verifyMap({ preparation, manifests: [manifest], inspect });
  assert.equal(ready.kind, "ready");
  assert.equal(hasCoverage("q1", ready), true);
  assert.equal(hasCoverage("q2", ready), false);
  for (const inspect of [
    () => Promise.reject(new Error("missing file")),
    () => Promise.resolve({ sha256: "bad", size: 127 }),
  ])
    assert.equal(
      (await verifyMap({ preparation, manifests: [manifest], inspect })).kind,
      "unavailable",
    );
  assert.equal(
    (await verifyMap({ preparation: null, manifests: [manifest], inspect })).kind,
    "unavailable",
  );
});

void test("AC tolerant parser: impossible dates are dropped without crashing; history codes are retained", () => {
  assert.equal(parseAssignment(task({ date: "2026-99-99" })), null);
  assert.equal(parseAssignment(task({ date: "2026-02-30" })), null);
  assert.equal(
    parseAssignment(task({ history: [{ date: "2026-01-01", summary_code: "unknown" }] }))
      ?.history[0]?.summary_code,
    "unknown",
  );
});

void test("Regression: newer server payload stays staged while pending work retains original ownership", async () => {
  const { store, outbox } = await setup();
  await store.replace(bundle(), FIXED_NOW);
  const event = makeEnvelope({ payload: { task_id: "task-1" } });
  await outbox.enqueue(event);
  await store.applyChanges({
    assignments: [
      change("upsert", 2, task({ version: 2, quadrant_id: "q2", risk: "normal", status: "done" })),
    ],
  });
  assert.equal((await store.read()).tasks[0]?.task.quadrant_id, "q1");
  await outbox.claimPending(1);
  await outbox.settle([
    { id: event.id, action: "accept", result: { code: "accepted", params: {} } },
  ]);
  const latest = (await store.read()).tasks[0];
  assert.equal(latest?.task.quadrant_id, "q2");
  assert.equal(latest.task.version, "2");
  assert.equal(latest.isKept, false);
});

void test("Regression: historical or explicitly different-task work cannot complete today's same-ovitrap assignment", async () => {
  const { store, outbox, db } = await setup();
  await store.replace(bundle([task({ ovitrap_id: "trap-1" })]), FIXED_NOW);
  await outbox.enqueue(makeEnvelope({ payload: { task_id: "other-task", ovitrap_id: "trap-1" } }));
  await outbox.enqueue(
    makeEnvelope({ payload: { ovitrap_id: "trap-1" }, device_time: "2026-01-14T10:00:00Z" }),
  );
  const claimed = await outbox.claimPending(10);
  await outbox.settle(
    claimed.map((event) => ({
      id: event.envelope.id,
      action: "accept" as const,
      result: { code: "accepted", params: {} },
    })),
  );
  const overlay = new OutboxWorkOverlay(db);
  const day = buildDay({
    tasks: (await store.read()).tasks,
    work: await overlay.read(),
    location: { kind: "denied" },
    now: FIXED_NOW,
  });
  assert.equal(day.completed, 0);
  await store.applyChanges({ assignments: [change("remove", 2)] });
  assert.equal((await store.read()).tasks.length, 0);
});

void test("Regression: sync network and cursor settlement share the bootstrap writer turn", async () => {
  const stores = await createStores();
  const store = new DayStore(stores.db);
  await store.replace(bundle(), FIXED_NOW);
  const entered = deferred<undefined>();
  const response = deferred<SyncCallResult>();
  const service = new DayBundleService({
    store,
    now: () => FIXED_NOW,
    transport: () =>
      Promise.resolve({ kind: "bundle", body: { ...bundle([]), cursor: "newer-bootstrap" } }),
  });
  const syncing = runSyncPass(
    {
      ...stores,
      ...service.syncHooks(),
      deviceId: FIXED_DEVICE_ID,
      now: () => FIXED_NOW,
      transport: () => {
        entered.resolve(undefined);
        return response.promise;
      },
    },
    { batchSize: 50 },
  );
  await entered.promise;
  const refreshing = service.refresh();
  response.resolve(answer([], { cursor: "old-sync" }));
  await Promise.all([syncing, refreshing]);
  assert.equal(await stores.kv.get(KV_KEYS.syncCursor), "newer-bootstrap");
  assert.equal((await store.read()).tasks.length, 0);
});

function deferred<T>() {
  let reject!: (error: Error) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
}

void test("Regression: late external navigation cannot overwrite newer selection or resurrect cleared state", async () => {
  const { kv } = await createStores();
  const launched = deferred<"launched">();
  const entered = deferred<undefined>();
  const service = new NavigationService({
    kv,
    now: () => FIXED_NOW,
    launcher: {
      launch: () => {
        entered.resolve(undefined);
        return launched.promise;
      },
    },
  });
  const opening = service.launch(task());
  await entered.promise;
  await service.select("second-point");
  launched.resolve("launched");
  await opening;
  assert.equal((await service.read())?.pointId, "second-point");
  const second = deferred<"launched">();
  const next = new NavigationService({
    kv,
    now: () => FIXED_NOW,
    launcher: { launch: () => second.promise },
  });
  const pending = next.launch(task());
  // Observe the committed selection before removing it; no fixed sleeps.
  await kv.get("day_navigation");
  await next.clear();
  second.resolve("launched");
  await pending;
  assert.equal(await next.read(), null);
});

void test("AC navigation adapter: verified geo handlers launch, absence and lock-task exceptions return alternatives", async () => {
  for (const kind of ["present", "absent", "blocked"] as const) {
    const opened: string[] = [];
    const launcher = createLinkingLauncher({
      canOpenURL: () => Promise.resolve(kind !== "absent"),
      openURL: (uri) => {
        if (kind === "blocked") return Promise.reject(new Error("lock task"));
        opened.push(uri);
        return Promise.resolve();
      },
    });
    const uri = "geo:19.400000,-99.100000?q=19.400000,-99.100000(OV-012)";
    assert.equal(
      await launcher.launch(uri),
      { present: "launched", absent: "no_handler", blocked: "denied" }[kind],
    );
    assert.deepEqual(opened, kind === "present" ? [uri] : []);
  }
});

void test("AC bootstrap wiring: api-client object response/quoted ETag/304/forced recovery without generated edits", async () => {
  const { store } = await setup();
  const requests: Request[] = [];
  const responses = [
    new Response(JSON.stringify(bundle()), { headers: { "Content-Type": "application/json" } }),
    new Response(null, { status: 304 }),
    new Response(JSON.stringify(bundle()), { headers: { "Content-Type": "application/json" } }),
  ];
  const client = createMobileApiClient({
    baseUrl: "http://192.168.1.20:8000",
    tokens: createMemoryTokenStore(),
    fetch: (request) => {
      requests.push(request);
      const response = responses.shift();
      assert.ok(response);
      return Promise.resolve(response);
    },
  });
  const service = new DayBundleService({
    store,
    transport: createBootstrapTransport(client),
    now: () => FIXED_NOW,
  });
  await service.refresh();
  await service.refresh();
  await service.refresh(true);
  assert.deepEqual(
    requests.map((request) => request.headers.get("If-None-Match")),
    [null, '"bundle-1"', null],
  );
  assert.ok(
    requests.every((request) => new URL(request.url).pathname === "/api/v1/field/bootstrap/"),
  );
  assert.equal((await service.read()).tasks.length, 1);
});

const preparation: MapPreparation = {
  status: "ready",
  version: "v1",
  requiredCoverage: ["q1"],
  coverage: ["q1"],
  assets: [{ id: manifest.asset_id, license: "OSM", size: 127, sha256: manifest.sha256 }],
  verifiedAssets: [
    {
      id: manifest.asset_id,
      fileRef: "file:///private/q1.pmtiles",
      size: 127,
      sha256: manifest.sha256,
    },
  ],
  progress: 1,
  error: null,
};
async function dayFixture() {
  const stores = await setup();
  const shift = new ShiftOpenStore(stores.db);
  await stores.store.replace(bundle(), FIXED_NOW);
  await shift.saveMap(preparation);
  const navigation = new NavigationService({
    kv: stores.kv,
    now: () => FIXED_NOW,
    launcher: { launch: () => Promise.resolve("launched") },
  });
  return { ...stores, shift, navigation };
}
void test("Regression: airplane cold map is published before a pending bootstrap transport settles", async () => {
  const fixture = await dayFixture();
  const network = deferred<never>();
  const published = deferred<undefined>();
  const bundle = new DayBundleService({
    store: fixture.store,
    now: () => FIXED_NOW,
    transport: () => network.promise,
  });
  const day = createTestDay(fixture, bundle);
  const refreshing = refreshDay(day, async () => {
    assert.equal((await day.read()).map.kind, "ready");
    published.resolve(undefined);
  });
  await published.promise;
  network.reject(new Error("airplane"));
  await assert.rejects(refreshing);
});

void test("AC storage: navigation state failure never launches externally or reports success", async () => {
  const { db, kv } = await createStores();
  let hasLaunched = false;
  await db.query(
    "CREATE TRIGGER fail_navigation BEFORE INSERT ON kv WHEN NEW.key='day_navigation' BEGIN SELECT RAISE(ABORT,'disk full'); END",
  );
  const service = new NavigationService({
    kv,
    now: () => FIXED_NOW,
    launcher: {
      launch: () => {
        hasLaunched = true;
        return Promise.resolve("launched");
      },
    },
  });
  await assert.rejects(service.launch(task()));
  assert.equal(hasLaunched, false);
  assert.equal(await service.read(), null);
});

void test("AC delta: nonpending tasks apply new versions, ignore equal/old versions and retain remove tombstones", async () => {
  const { store } = await setup();
  await store.replace(bundle(), FIXED_NOW);
  await store.applyChanges({
    assignments: [change("upsert", 2, task({ version: 2, risk: "normal" }))],
  });
  await store.applyChanges({
    assignments: [
      change("upsert", 2, task({ version: 2, risk: "high" })),
      change("upsert", 1, task()),
    ],
  });
  assert.equal((await store.read()).tasks[0]?.task.risk, "normal");
  await store.applyChanges({
    assignments: [change("remove", 3), change("upsert", 2, task({ version: 2 }))],
  });
  assert.equal((await store.read()).tasks.length, 0);
});

void test("AC map delta: manifest updates/removes use asset identity and version guards", async () => {
  const { store } = await setup();
  await store.replace(bundle(), FIXED_NOW);
  const entry = {
    sequence: 2,
    action: "upsert",
    resource_type: "map_manifests",
    resource_id: manifest.asset_id,
    resource_version: "2",
    data: { ...manifest, version: "2", size_bytes: 200 },
  };
  await store.applyChanges({ map_manifests: [entry] });
  await store.applyChanges({
    map_manifests: [{ ...entry, data: { ...manifest, version: "2", size_bytes: 100 } }],
  });
  assert.equal((await store.read()).manifests[0]?.size_bytes, 200);
  await store.applyChanges({
    map_manifests: [
      { ...entry, sequence: 3, action: "remove", resource_version: "3", data: {} },
      entry,
    ],
  });
  assert.equal((await store.read()).manifests.length, 0);
});

void test("AC access errors: only revoked session/scope clear downloads; expired authentication preserves cache", async () => {
  for (const [status, code, isRevoked] of [
    [401, "session_revoked", true],
    [403, "scope", true],
    [401, "token_expired", false],
  ] as const) {
    const { store, outbox } = await setup();
    await store.replace(bundle(), FIXED_NOW);
    const event = makeEnvelope();
    await outbox.enqueue(event);
    const client = createMobileApiClient({
      baseUrl: "http://192.168.1.20:8000",
      tokens: createMemoryTokenStore(),
      fetch: () =>
        Promise.resolve(
          new Response(JSON.stringify({ code, detail: "Fixture error", params: {} }), {
            status,
            headers: { "Content-Type": "application/json" },
          }),
        ),
    });
    const service = new DayBundleService({
      store,
      transport: createBootstrapTransport(client),
      now: () => FIXED_NOW,
    });
    if (isRevoked) await service.refresh();
    else await assert.rejects(service.refresh());
    assert.equal((await store.read()).tasks.length, isRevoked ? 0 : 1);
    assert.equal((await outbox.countByStatus()).pending, 1);
  }
});

void test("Regression: a sync response from a replacement session cannot install projections", async () => {
  const { credentials } = await makeCredentials();
  const response = deferred<Response>();
  const entered = deferred<undefined>();
  const requests = new SessionRequests({
    credentials,
    isOnline: () => true,
    endSession: () => credentials.markEnded(credentials.getSnapshot().sessionId),
    refresh: () => Promise.reject(new Error("No refresh expected.")),
  });
  const transport = createScopedSyncTransport({
    tokens: credentials,
    requests,
    fetch: () => {
      entered.resolve(undefined);
      return response.promise;
    },
  });
  const pending = transport({
    device_id: FIXED_DEVICE_ID,
    sent_at: FIXED_NOW.toISOString(),
    events: [],
  });
  await entered.promise;
  await credentials.update((current) => ({
    ...current,
    sessionId: randomUUID(),
    origin: "https://replacement.invalid",
  }));
  const success = answer([]);
  assert.ok(success.ok);
  response.resolve(
    new Response(JSON.stringify(success.response), {
      headers: { "Content-Type": "application/json" },
    }),
  );
  assert.deepEqual(await pending, { ok: false, failure: { kind: "network" } });
});

void test("Regression: a second capture for the staged ovitrap remains visible on later removal", async () => {
  const { store, outbox } = await setup();
  await store.replace(bundle([task({ ovitrap_id: "old-trap" })]), FIXED_NOW);
  const first = makeEnvelope({ payload: { task_id: "task-1" } });
  await outbox.enqueue(first);
  await store.applyChanges({
    assignments: [change("upsert", 2, task({ version: 2, ovitrap_id: "new-trap" }))],
  });
  await outbox.claimPending(1);
  await outbox.settle([
    { id: first.id, action: "accept", result: { code: "accepted", params: {} } },
  ]);
  await outbox.enqueue(makeEnvelope({ payload: { ovitrap_id: "new-trap" } }));
  await store.applyChanges({ assignments: [change("remove", 3)] });
  const retained = (await store.read()).tasks[0];
  assert.equal(retained?.task.ovitrap_id, "new-trap");
  assert.equal(retained.isKept, true);
});

void test("Regression: removed assignments cannot launch external navigation from a stale screen", async () => {
  const fixture = await dayFixture();
  const day = createTestDay(fixture);
  await fixture.service.applyProjectionChanges({ assignments: [change("remove", 2)] });
  await assert.rejects(day.navigate("task-1"), /no longer assigned/);
  await assert.rejects(day.select("task-1"), /no longer assigned/);
  assert.equal(await fixture.navigation.read(), null);
});

void test("AC ordering: high risk precedes nearest fresh fix and distance precedes point code", async () => {
  const { store } = await setup();
  const quadrant = "11111111-1111-4111-8111-111111111111";
  const points = [
    { id: "22222222-2222-4222-8222-222222222222", code: "OV-010", location: [-99.1, 50] },
    { id: "33333333-3333-4333-8333-333333333333", code: "OV-001", location: [1, 1] },
    { id: "44444444-4444-4444-8444-444444444444", code: "OV-999", location: [0, 0] },
  ];
  await store.replace(
    {
      ...bundle(
        points.map((point, index) =>
          task({
            id: point.id,
            point: point.id,
            point_code: point.code,
            quadrant_id: quadrant,
            risk: index === 0 ? "high" : "normal",
          }),
        ),
      ),
      sampling_points: points.map((point) => ({
        ...point,
        quadrant_id: quadrant,
        block_id: "55555555-5555-4555-8555-555555555555",
        is_retired: false,
        version: 1,
      })),
    },
    FIXED_NOW,
  );
  const day = buildDay({
    tasks: (await store.read()).tasks,
    work: [],
    location: {
      kind: "granted",
      fix: { lat: 0, lng: 0, accuracy_m: 10, fixedAt: FIXED_NOW.getTime() },
    },
    now: FIXED_NOW,
  });
  assert.deepEqual(
    day.tasks.map((row) => row.task.point_code),
    ["OV-010", "OV-999", "OV-001"],
  );
  assert.equal(day.tasks[1]?.distanceM, 0);
});

function createTestDay(fixture: Awaited<ReturnType<typeof dayFixture>>, bundle = fixture.service) {
  return new DayService({
    bundle,
    kv: fixture.kv,
    shift: fixture.shift,
    navigation: fixture.navigation,
    work: new OutboxWorkOverlay(fixture.db),
    location: { start: () => Promise.resolve(() => undefined) },
    maps: { prepare: () => Promise.resolve(preparation) },
    inspect: () => Promise.resolve({ sha256: manifest.sha256, size: 127 }),
    hasOpenShift: () => Promise.resolve(true),
  });
}

void test("AC location: missing accuracy rule never fabricates a weak verdict", () => {
  const state: LocationState = {
    kind: "granted",
    fix: { lat: 1, lng: 1, accuracy_m: 999, fixedAt: FIXED_NOW.getTime() - 1000 },
  };
  assert.equal(
    locationMessage({ state, now: FIXED_NOW, maxAccuracyM: null }).key,
    "mobile.day.locationFix",
  );
  assert.equal(
    locationMessage({ state, now: FIXED_NOW, maxAccuracyM: 50 }).key,
    "mobile.day.locationWeak",
  );
});

void test("AC refresh: distant next-change deadlines are rearmed and cancelled subscriptions do not refresh", () => {
  let now = 0;
  let refreshes = 0;
  let callback: (() => void) | undefined;
  const delays: number[] = [];
  const cancel = scheduleDueRefresh({
    dueAt: new Date(3_000_000_000).toISOString(),
    now: () => now,
    refresh: () => {
      refreshes += 1;
    },
    schedule: (next, delay) => {
      callback = next;
      delays.push(delay);
      return () => undefined;
    },
  });
  assert.equal(refreshes, 0);
  now = 2_147_483_647;
  callback?.();
  assert.deepEqual(delays, [2_147_483_647, 852_516_353]);
  now = 3_000_000_000;
  callback?.();
  assert.equal(refreshes, 1);
  cancel();
  callback?.();
  assert.equal(refreshes, 1);
});

void test("Regression final upload: a revoked 200 settles its results, removes downloads and retains unsent evidence", async () => {
  const fixture = await dayFixture();
  const day = createTestDay(fixture);
  await day.verifyMap();
  await fixture.navigation.select("task-1");
  const first = makeEnvelope({ payload: { task_id: "task-1" } });
  const unsent = makeEnvelope({ payload: { task_id: "task-1", note: "retained evidence" } });
  await fixture.outbox.enqueue(first);
  await fixture.outbox.enqueue(unsent);
  // A revoked final upload has no downloadable projections to refresh before acknowledging results.
  await fixture.db.query(
    "CREATE TRIGGER no_revoked_projection_refresh BEFORE UPDATE ON day_bundle_meta BEGIN SELECT RAISE(ABORT,'projection refresh unavailable'); END",
  );
  const final = answer([accepted(first.id)]);
  assert.ok(final.ok);
  let requests = 0;
  const transport = createSyncTransport(
    createMobileApiClient({
      baseUrl: "http://192.168.1.20:8000",
      tokens: createMemoryTokenStore(),
      fetch: () => {
        requests += 1;
        return Promise.resolve(
          new Response(JSON.stringify(final.response), {
            headers: { "Content-Type": "application/json", "X-Session-Revoked": "true" },
          }),
        );
      },
    }),
  );
  const outcome = await runSyncPass(
    {
      ...fixture,
      ...fixture.service.syncHooks(),
      deviceId: FIXED_DEVICE_ID,
      now: () => FIXED_NOW,
      transport,
    },
    { batchSize: 1 },
  );
  assert.deepEqual(outcome, { kind: "blocked", reason: "needsLogin", code: "session_revoked" });
  assert.equal(requests, 1);
  const cached = await day.read();
  assert.equal(cached.tasks.length, 0);
  assert.equal(cached.manifests.length, 0);
  assert.equal(cached.map.kind, "unavailable");
  assert.equal(cached.navigation, null);
  assert.equal(await fixture.kv.get(KV_KEYS.syncCursor), null);
  assert.equal(await fixture.shift.map(), null);
  const rows = await fixture.db.query(
    "SELECT id,payload,local_status FROM outbox_event ORDER BY seq",
  );
  assert.deepEqual(
    rows.map((row) => ({ ...row })),
    [
      { id: first.id, payload: JSON.stringify(first.payload), local_status: "sent" },
      { id: unsent.id, payload: JSON.stringify(unsent.payload), local_status: "pending" },
    ],
  );
});

void test("Regression bootstrap replacement: same-version tasks and manifests reappear after an authoritative empty bundle", async () => {
  const { store } = await setup();
  await store.replace(bundle(), FIXED_NOW);
  await store.replace({ ...bundle([]), map_manifests: [] }, FIXED_NOW);
  assert.equal((await store.read()).tasks.length, 0);
  assert.equal((await store.read()).manifests.length, 0);
  await store.replace(bundle(), FIXED_NOW);
  const restored = await store.read();
  assert.equal(restored.tasks[0]?.task.point_code, "OV-012");
  assert.equal(restored.manifests[0]?.asset_id, manifest.asset_id);
});

void test("Regression bootstrap replacement: repeating a staged version retains the original pending-work view", async () => {
  const { store, outbox } = await setup();
  await store.replace(bundle(), FIXED_NOW);
  await outbox.enqueue(makeEnvelope({ payload: { task_id: "task-1" } }));
  const updated = bundle([task({ version: 2, quadrant_id: "new-owner" })]);
  await store.replace(updated, FIXED_NOW);
  await store.replace(updated, FIXED_NOW);
  const kept = (await store.read()).tasks[0];
  assert.equal(kept?.task.quadrant_id, "q1");
  assert.equal(kept.isKept, true);
});

void test("Regression manifest readiness: reported incomplete or unlicensed assets replace earlier coverage", async () => {
  const unavailable = [{ sha256: "" }, { version: "" }, { size_bytes: 0 }, { licensed: false }];
  for (const update of unavailable) {
    const fixture = await dayFixture();
    const day = createTestDay(fixture);
    const other = { ...manifest, asset_id: "q2.pmtiles", quadrant_id: "q2" };
    await fixture.store.replace({ ...bundle(), map_manifests: [manifest, other] }, FIXED_NOW);
    await fixture.shift.saveMap({
      ...preparation,
      requiredCoverage: ["q1", "q2"],
      coverage: ["q1", "q2"],
      assets: [
        ...preparation.assets,
        { id: other.asset_id, license: "OSM", size: 127, sha256: other.sha256 },
      ],
      verifiedAssets: [
        ...preparation.verifiedAssets,
        {
          id: other.asset_id,
          fileRef: "file:///private/q2.pmtiles",
          size: 127,
          sha256: other.sha256,
        },
      ],
    });
    await day.verifyMap();
    assert.equal((await day.read()).map.kind, "ready");
    const entry = { ...manifest, version: "2", ...update };
    await fixture.service.applyProjectionChanges({
      map_manifests: [
        {
          sequence: 2,
          action: "upsert",
          resource_type: "map_manifests",
          resource_id: manifest.asset_id,
          resource_version: "2",
          data: entry,
        },
      ],
    });
    assert.deepEqual(
      (await fixture.store.read()).manifests.find((asset) => asset.asset_id === manifest.asset_id),
      entry,
    );
    assert.equal((await day.read()).map.kind, "unavailable");
    await day.verifyMap();
    const cached = await day.read();
    assert.equal(cached.map.kind, "unavailable");
    assert.equal(hasCoverage("q1", cached.map), false);
    assert.equal(cached.tasks.length, 1);
  }
});

void test("Regression manifest boundary: a malformed manifest cannot advance the sync cursor", async () => {
  const fixture = await dayFixture();
  const success = answer([], { cursor: "must-not-advance" });
  assert.ok(success.ok);
  const response = {
    ...success.response,
    changes: {
      ...success.response.changes,
      map_manifests: [
        {
          sequence: 2,
          action: "upsert" as const,
          resource_type: "map_manifests",
          resource_id: manifest.asset_id,
          resource_version: "2",
          data: { asset_id: manifest.asset_id, licensed: false },
        },
      ],
    },
  };
  await assert.rejects(
    runSyncPass(
      {
        ...fixture,
        ...fixture.service.syncHooks(),
        deviceId: FIXED_DEVICE_ID,
        now: () => FIXED_NOW,
        transport: () => Promise.resolve({ ok: true, response }),
      },
      { batchSize: 50 },
    ),
  );
  assert.equal(await fixture.kv.get(KV_KEYS.syncCursor), "bootstrap-cursor");
});

function sessionScope(
  credentials: Awaited<ReturnType<typeof makeCredentials>>["credentials"],
): string | null {
  const current = credentials.getSnapshot();
  return current.status === "active" && current.pair !== null
    ? JSON.stringify([current.sessionId, current.origin])
    : null;
}
async function authDayFixture(history: unknown[] = []) {
  const fixture = await dayFixture();
  const { credentials, secrets } = await makeCredentials();
  // eslint-disable-next-line prefer-const -- the transport closure needs it before the wrapper is built
  let requests!: SessionRequests;
  const service = createDayBundle({
    db: fixture.db,
    tokens: credentials,
    requests: () => requests,
    fetch: () => Promise.resolve(jsonResponse({ ...bundle(), history })),
  });
  const auth = new AuthController({
    ...fixture,
    credentials,
    clearSessionData: service.clearForAuth,
    randomBytes,
    now: () => FIXED_NOW.getTime(),
    hasLocalRecords: () => Promise.resolve(true),
    login: () => Promise.reject(new Error("No login in this fixture.")),
    fetchRules: () => Promise.resolve(null),
  });
  requests = new SessionRequests({
    credentials,
    isOnline: () => true,
    endSession: (hasFinalReceipt) => auth.endSession(hasFinalReceipt),
    refresh: () => Promise.resolve({ access: randomUUID(), refresh: randomUUID() }),
  });
  await auth.load();
  return { ...fixture, credentials, secrets, auth, requests, service };
}
function jsonResponse(
  body: unknown,
  options: { status?: number; isFinal?: boolean } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(options.isFinal === true ? { "X-Session-Revoked": "true" } : {}),
    },
  });
}
void test("Merge session: bootstrap accepts a rotated bearer at its pinned issuer and preserves If-None-Match", async () => {
  const fixture = await authDayFixture();
  const sent: Request[] = [];
  const client = createScopedApiClient({
    tokens: fixture.credentials,
    fetch: (request) => {
      sent.push(request);
      return Promise.resolve(
        sent.length === 1
          ? jsonResponse({ code: "token_expired", detail: "Fixture" }, { status: 401 })
          : jsonResponse(bundle()),
      );
    },
  });
  const original = fixture.credentials.getAccessToken();
  const service = new DayBundleService({
    store: fixture.store,
    now: () => FIXED_NOW,
    getScopeKey: () => sessionScope(fixture.credentials),
    transport: createBootstrapTransport(client, fixture.requests),
  });
  await service.refresh();
  assert.equal(sent.length, 2);
  assert.ok(sent.every((request) => new URL(request.url).origin === "https://example.invalid"));
  assert.ok(sent.every((request) => request.headers.get("If-None-Match") === '"bundle-1"'));
  assert.notEqual(fixture.credentials.getAccessToken(), original);
  assert.equal((await service.read()).tasks.length, 1);
});
void test("Merge session: logout during a pending bootstrap clears downloads without deadlock or resurrection", async () => {
  const fixture = await authDayFixture();
  const entered = deferred<undefined>();
  const network = deferred<import("../src/features/day/bundle-service.ts").BundleResult>();
  const service = new DayBundleService({
    store: fixture.store,
    now: () => FIXED_NOW,
    getScopeKey: () => sessionScope(fixture.credentials),
    transport: () => {
      entered.resolve(undefined);
      return network.promise;
    },
  });
  const auth = new AuthController({
    ...fixture,
    clearSessionData: service.clearForAuth,
    randomBytes,
    now: () => FIXED_NOW.getTime(),
    hasLocalRecords: () => Promise.resolve(true),
    login: () => Promise.reject(new Error("No login")),
    fetchRules: () => Promise.resolve(null),
  });
  await auth.load();
  await fixture.navigation.select("task-1");
  await fixture.outbox.enqueue(makeEnvelope());
  const refreshing = service.refresh();
  await entered.promise;
  await auth.endSession();
  assert.equal((await service.read()).tasks.length, 0);
  assert.equal(await fixture.navigation.read(), null);
  network.resolve({ kind: "bundle", body: bundle() });
  await assert.rejects(refreshing);
  assert.equal((await service.read()).tasks.length, 0);
  assert.equal((await fixture.outbox.countByStatus()).pending, 1);
});
void test("Merge session: ordinary local lock retains downloads while boot reconciles ended-session cleanup", async () => {
  const fixture = await authDayFixture(LAB_HISTORY);
  await fixture.service.refresh();
  assert.deepEqual(
    await downloadedLabKinds(fixture.db),
    LAB_HISTORY.map((row) => `history.${row.kind}`).sort(),
  );
  assert.equal(await fixture.store.needsBootstrap(), true, "Lab is not current capture authority");
  await fixture.auth.lock();
  assert.equal((await fixture.service.read()).tasks.length, 1);
  assert.equal((await downloadedLabKinds(fixture.db)).length, LAB_HISTORY.length);
  await fixture.auth.endSession();
  // An interrupted earlier cleanup can leave old projections on disk.
  await fixture.store.replace(bundle(), FIXED_NOW);
  await fixture.auth.load();
  assert.equal((await fixture.service.read()).tasks.length, 0);
  assert.equal((await downloadedLabKinds(fixture.db)).length, 0);
});
void test("Merge session: final upload completes credential erasure only after result settlement and projection cleanup", async () => {
  const fixture = await authDayFixture();
  const event = makeEnvelope();
  await fixture.outbox.enqueue(event);
  const result = answer([accepted(event.id)]);
  assert.ok(result.ok);
  const transport = createScopedSyncTransport({
    tokens: fixture.credentials,
    requests: fixture.requests,
    fetch: () => Promise.resolve(jsonResponse(result.response, { isFinal: true })),
  });
  await runSyncPass(
    {
      ...fixture,
      ...fixture.service.syncHooks(),
      transport,
      deviceId: FIXED_DEVICE_ID,
      now: () => FIXED_NOW,
    },
    { batchSize: 50 },
  );
  assert.equal((await fixture.outbox.countByStatus()).sent, 1);
  assert.equal((await fixture.service.read()).tasks.length, 0);
  assert.equal(fixture.credentials.getSnapshot().pair, null);
  await retainedFinalFactoryRetry();
});

async function retainedFinalFactoryRetry() {
  const directory = await mkdtemp(join(tmpdir(), "m09-final-factory-"));
  const path = join(directory, "synthetic.sqlite");
  let local = await openTestDatabase(path);
  try {
    const identity = await makeCredentials();
    let credentials = identity.credentials;
    let fail = true;
    let posts = 0;
    let event = makeEnvelope();
    let afterReceipt: () => Promise<void> = () => Promise.resolve();
    await new OutboxRepository(local.executor, () => FIXED_NOW).enqueue(event);
    await credentials.markEnded(credentials.getSnapshot().sessionId);
    let reply = answer([accepted(event.id)]);
    assert.ok(reply.ok);
    const build = () => {
      const requests = new SessionRequests({
        credentials,
        isOnline: () => true,
        refresh: () => Promise.reject(new Error("No refresh for final capability")),
        endSession: (receipt) => service.clearForAuth(receipt),
      });
      const service = createDayBundle({
        db: local.executor,
        tokens: credentials,
        requests: () => requests,
        getCaptureIdentity: () => null,
        fetch: () => Promise.reject(new Error("No ended-session bootstrap HTTP")),
      });
      const transport = createScopedSyncTransport({
        tokens: credentials,
        requests,
        fetch: () => {
          posts++;
          if (fail) return Promise.reject(new Error("Interrupted final POST"));
          assert.ok(reply.ok);
          return Promise.resolve(jsonResponse(reply.response, { isFinal: true }));
        },
      });
      const outbox = new OutboxRepository(local.executor, () => FIXED_NOW);
      const settle = outbox.settle.bind(outbox);
      outbox.settle = async (transitions, extra) => {
        await settle(transitions, extra);
        if (transitions.some((item) => item.action === "accept")) await afterReceipt();
      };
      return {
        service,
        run: () =>
          runSyncPass(
            {
              outbox,
              kv: new KvStore(local.executor),
              ...service.syncHooks(),
              transport,
              deviceId: FIXED_DEVICE_ID,
              now: () => FIXED_NOW,
            },
            { batchSize: 50 },
          ),
      };
    };
    let runtime = build();
    assert.equal((await runtime.run()).kind, "retry");
    assert.equal(posts, 1, "real factory permits only the retained final POST");
    assert.equal(credentials.isUnlocked(), false);
    await assert.rejects(runtime.service.refresh());
    await assert.rejects(
      runtime.service.captureLifecycleSource()(null, () => Promise.resolve(true)),
    );
    assert.equal(posts, 1);
    local.close();
    local = await openTestDatabase(path);
    credentials = new CredentialStore(identity.secrets);
    await credentials.load();
    assert.equal(credentials.getSnapshot().status, "ended");
    fail = false;
    runtime = build();
    assert.equal((await runtime.run()).kind, "blocked");
    assert.equal(posts, 2);
    assert.deepEqual(
      (await local.executor.query("SELECT id,local_status FROM outbox_event")).map((row) => [
        row.id,
        row.local_status,
      ]),
      [[event.id, "sent"]],
    );
    assert.equal(credentials.getSnapshot().pair, null);
    event = makeEnvelope();
    reply = answer([accepted(event.id)]);
    await new OutboxRepository(local.executor, () => FIXED_NOW).enqueue(event);
    await credentials.update((current) => ({
      ...current,
      origin: "https://example.invalid",
      sessionId: "old-final-owner",
      status: "active",
      pair: { access: "old-final", refresh: "old-final-refresh" },
    }));
    await credentials.markEnded("old-final-owner");
    const settled = deferred<undefined>(),
      release = deferred<undefined>();
    afterReceipt = async () => {
      settled.resolve(undefined);
      await release.promise;
    };
    runtime = build();
    const lateCleanup = runtime.run();
    await settled.promise;
    assert.equal(
      (
        await local.executor.query("SELECT local_status FROM outbox_event WHERE id=?", [event.id])
      )[0]?.local_status,
      "sent",
      "Receipt is durable before cleanup admission",
    );
    await credentials.finishEndedSession("old-final-owner");
    await credentials.update((current) => ({
      ...current,
      sessionId: "new-current-session",
      status: "active",
      pair: { access: "new-access", refresh: "new-refresh" },
    }));
    await new DayStore(local.executor).replace(bundle(), FIXED_NOW);
    release.resolve(undefined);
    await assert.rejects(lateCleanup);
    assert.equal(credentials.getSnapshot().sessionId, "new-current-session");
    assert.equal(
      (await new DayStore(local.executor).read()).tasks.length,
      1,
      "Old final completion cannot clear a replacement session's projections",
    );
  } finally {
    local.close();
    await rm(directory, { recursive: true, force: true });
  }
}
void test("UI state: local loading is distinct from empty, refresh retains data and a failed refresh can retry", async () => {
  const fixture = await dayFixture();
  const network = deferred<import("../src/features/day/bundle-service.ts").BundleResult>();
  const entered = deferred<undefined>();
  let shouldFail = true;
  const service = new DayBundleService({
    store: fixture.store,
    now: () => FIXED_NOW,
    transport: () => {
      entered.resolve(undefined);
      return shouldFail ? network.promise : Promise.resolve({ kind: "unchanged" });
    },
  });
  const view = new DayViewController(createTestDay(fixture, service));
  assert.equal(dayViewPhase(view.getSnapshot()), "loading");
  await view.load();
  assert.equal(view.getSnapshot().state?.tasks.length, 1);
  const refreshing = view.refresh();
  assert.equal(view.getSnapshot().isRefreshing, true);
  assert.equal(view.getSnapshot().state?.tasks.length, 1);
  await entered.promise;
  network.reject(new Error("offline"));
  await refreshing;
  assert.equal(view.getSnapshot().isRefreshing, false);
  assert.ok(view.getSnapshot().errors.refresh);
  assert.equal(view.getSnapshot().state?.tasks.length, 1);
  shouldFail = false;
  await view.refresh();
  assert.equal(view.getSnapshot().errors.refresh, null);
});
void test("UI state: a local read failure stays scoped and retry distinguishes no tasks from completed work", async () => {
  const fixture = await dayFixture();
  const day = createTestDay(fixture);
  let isReadable = false;
  const view = new DayViewController({
    bundle: day.bundle,
    verifyMap: () => day.verifyMap(),
    read: () => (isReadable ? day.read() : Promise.reject(new Error("storage"))),
  });
  await view.load();
  assert.equal(dayViewPhase(view.getSnapshot()), "error");
  isReadable = true;
  await fixture.store.replace(bundle([]), FIXED_NOW);
  await view.load();
  assert.equal(dayViewPhase(view.getSnapshot()), "empty");
  await fixture.store.replace(bundle(), FIXED_NOW);
  await fixture.outbox.enqueue(makeEnvelope({ payload: { task_id: "task-1" } }));
  await view.load();
  assert.equal(dayViewPhase(view.getSnapshot()), "content");
  await fixture.store.replace(bundle([task({ is_completed: true })]), FIXED_NOW);
  await view.load();
  assert.equal(dayViewPhase(view.getSnapshot()), "complete");
});
void test("Merge session: an active POST returning after logout settles evidence without resurrecting projections before the final POST", async () => {
  const fixture = await authDayFixture();
  const event = makeEnvelope();
  await fixture.outbox.enqueue(event);
  const active = deferred<Response>();
  const final = deferred<Response>();
  const firstEntered = deferred<undefined>();
  const finalEntered = deferred<undefined>();
  let calls = 0;
  const transport = createScopedSyncTransport({
    tokens: fixture.credentials,
    requests: fixture.requests,
    fetch: () => {
      calls += 1;
      if (calls === 1) {
        firstEntered.resolve(undefined);
        return active.promise;
      }
      finalEntered.resolve(undefined);
      return final.promise;
    },
  });
  const running = runSyncPass(
    {
      ...fixture,
      ...fixture.service.syncHooks(),
      transport,
      deviceId: FIXED_DEVICE_ID,
      now: () => FIXED_NOW,
    },
    { batchSize: 50 },
  );
  await firstEntered.promise;
  await fixture.auth.endSession();
  const success = answer([accepted(event.id)], { cursor: "old-session-cursor" });
  assert.ok(success.ok);
  active.resolve(
    jsonResponse({
      ...success.response,
      changes: {
        ...success.response.changes,
        assignments: [change("upsert", 2, task({ version: 2 }))],
      },
    }),
  );
  await finalEntered.promise;
  assert.equal((await fixture.service.read()).tasks.length, 0);
  assert.equal(await fixture.kv.get(KV_KEYS.syncCursor), null);
  assert.equal((await fixture.outbox.countByStatus()).sent, 1);
  assert.notEqual(fixture.credentials.getSnapshot().pair, null);
  const empty = answer([]);
  assert.ok(empty.ok);
  final.resolve(jsonResponse(empty.response, { isFinal: true }));
  await running;
  assert.equal(fixture.credentials.getSnapshot().pair, null);
  assert.equal(calls, 2);
});
void test("UI state: a late read cannot restore a snapshot captured before session cleanup", async () => {
  const fixture = await dayFixture();
  const day = createTestDay(fixture);
  const old = await day.read();
  const pending = deferred<Awaited<ReturnType<typeof day.read>>>();
  let reads = 0;
  const view = new DayViewController({
    bundle: day.bundle,
    verifyMap: () => day.verifyMap(),
    read: () => (++reads === 1 ? pending.promise : day.read()),
  });
  const stale = view.load();
  await fixture.service.clearSessionData();
  await view.load();
  pending.resolve(old);
  await stale;
  assert.equal(view.getSnapshot().state?.tasks.length, 0);
});

void test("Merge session: logout during a local assignment read prevents selection or navigation", async () => {
  const fixture = await dayFixture();
  const entered = deferred<undefined>();
  const pending = deferred<Awaited<ReturnType<DayStore["read"]>>>();
  let scope: string | null = "active-session";
  class DeferredStore extends DayStore {
    override read() {
      entered.resolve(undefined);
      return pending.promise;
    }
  }
  const service = new DayBundleService({
    store: new DeferredStore(fixture.db),
    now: () => FIXED_NOW,
    getScopeKey: () => scope,
    transport: () => Promise.resolve({ kind: "unchanged" }),
  });
  let actions = 0;
  const selection = service.withAssignments(() => {
    actions += 1;
    return Promise.resolve();
  });
  const rejected = assert.rejects(selection);
  await entered.promise;
  scope = null;
  const cleanup = service.clearSessionData();
  pending.resolve(await fixture.store.read());
  await rejected;
  await cleanup;
  assert.equal(actions, 0);
  assert.equal((await fixture.store.read()).tasks.length, 0);
});

void test("Merge session: password exhaustion blocks replacement login until downloaded data cleanup completes", async () => {
  const fixture = await authDayFixture();
  const entered = deferred<undefined>();
  const cleanup = deferred<undefined>();
  let logins = 0;
  await fixture.credentials.update((current) => ({ ...current, passwordAttempts: 4 }));
  const auth = new AuthController({
    ...fixture,
    clearSessionData: async () => {
      entered.resolve(undefined);
      await cleanup.promise;
      await fixture.service.clearSessionData();
    },
    randomBytes,
    now: () => FIXED_NOW.getTime(),
    hasLocalRecords: () => Promise.resolve(false),
    login: () => {
      logins += 1;
      return Promise.reject(new Error("Replacement login must remain gated."));
    },
    fetchRules: () => Promise.resolve(null),
    verify: () => Promise.resolve(false),
  });
  await auth.load();
  auth.setOnline(true);
  const unlocking = auth.unlock("incorrect", "password");
  await entered.promise;
  assert.equal(fixture.credentials.getSnapshot().pair, null);
  assert.equal(auth.canLogin(), false);
  await auth.login("replacement", "password");
  assert.equal(logins, 0);
  assert.equal((await fixture.store.read()).tasks.length, 1);
  cleanup.resolve(undefined);
  await unlocking;
  assert.equal((await fixture.store.read()).tasks.length, 0);
  assert.equal(auth.canLogin(), true);
});

void test("Merge session: a queued sync batch cannot use a replacement account on the same issuer", async () => {
  const fixture = await authDayFixture();
  const entered = deferred<undefined>();
  const release = deferred<undefined>();
  const replacing = fixture.credentials.runExclusive(async (transaction) => {
    entered.resolve(undefined);
    await release.promise;
    await transaction.write({ ...transaction.read(), sessionId: randomUUID() });
  });
  await entered.promise;
  let posts = 0;
  const transport = createScopedSyncTransport({
    tokens: fixture.credentials,
    requests: fixture.requests,
    fetch: () => {
      posts += 1;
      return Promise.reject(new Error("A stale batch must not reach HTTP."));
    },
  });
  const sending = transport({
    device_id: FIXED_DEVICE_ID,
    sent_at: FIXED_NOW.toISOString(),
    events: [],
  });
  release.resolve(undefined);
  await replacing;
  assert.deepEqual(await sending, { ok: false, failure: { kind: "network" } });
  assert.equal(posts, 0);
});

void test("Merge session: a bootstrap client cannot attach a replacement account's bearer on the same issuer", async () => {
  const fixture = await authDayFixture();
  let gets = 0;
  const client = createScopedApiClient({
    tokens: fixture.credentials,
    fetch: () => {
      gets += 1;
      return Promise.reject(new Error("A stale client must not reach HTTP."));
    },
  });
  await fixture.credentials.update((current) => ({ ...current, sessionId: randomUUID() }));
  await assert.rejects(createBootstrapTransport(client, fixture.requests)("bundle-1"));
  assert.equal(gets, 0);
});

void test("UI state: an abandoned session controller cannot publish a pending local read", async () => {
  const fixture = await dayFixture();
  const day = createTestDay(fixture);
  const pending = deferred<Awaited<ReturnType<typeof day.read>>>();
  const view = new DayViewController({
    bundle: day.bundle,
    verifyMap: () => day.verifyMap(),
    read: () => pending.promise,
  });
  const loading = view.load();
  view.stop();
  pending.resolve(await day.read());
  await loading;
  assert.equal(view.getSnapshot().state, null);
});

void test("Merge revocation: late map preparation progress and completion cannot recreate cleared metadata", async () => {
  const fixture = await dayFixture();
  await fixture.kv.remove("shift_open_map");
  const report = deferred<(progress: MapPreparation) => Promise<void>>();
  const prepared = deferred<MapPreparation>();
  const day = new DayService({
    bundle: fixture.service,
    kv: fixture.kv,
    shift: fixture.shift,
    navigation: fixture.navigation,
    work: new OutboxWorkOverlay(fixture.db),
    location: { start: () => Promise.resolve(() => undefined) },
    maps: {
      prepare: (publish) => {
        report.resolve(publish);
        return prepared.promise;
      },
    },
    inspect: () => Promise.resolve({ sha256: manifest.sha256, size: 127 }),
    hasOpenShift: () => Promise.resolve(true),
  });
  const verifying = day.verifyMap(true);
  const rejected = assert.rejects(verifying);
  const publish = await report.promise;
  // A scope revocation can leave the same session identity active.
  await fixture.service.clearSessionData();
  await assert.rejects(publish(preparation));
  prepared.resolve(preparation);
  await rejected;
  assert.equal(await fixture.shift.map(), null);
  assert.equal((await day.read()).map.kind, "unavailable");
});

void test("Merge revocation: a late file inspection cannot publish a map into a subsequent bundle", async () => {
  const fixture = await dayFixture();
  const entered = deferred<undefined>();
  const inspected = deferred<{ sha256: string; size: number }>();
  const day = new DayService({
    bundle: fixture.service,
    kv: fixture.kv,
    shift: fixture.shift,
    navigation: fixture.navigation,
    work: new OutboxWorkOverlay(fixture.db),
    location: { start: () => Promise.resolve(() => undefined) },
    maps: { prepare: () => Promise.resolve(preparation) },
    inspect: () => {
      entered.resolve(undefined);
      return inspected.promise;
    },
    hasOpenShift: () => Promise.resolve(true),
  });
  const verifying = day.verifyMap();
  const rejected = assert.rejects(verifying);
  await entered.promise;
  await fixture.service.clearSessionData();
  await fixture.store.replace(bundle(), FIXED_NOW);
  inspected.resolve({ sha256: manifest.sha256, size: 127 });
  await rejected;
  assert.equal((await day.read()).map.kind, "unavailable");
});

function producerTask(overrides = {}) {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    kind: "task",
    quadrant_id: "20000000-0000-4000-8000-000000000001",
    courier: "30000000-0000-4000-8000-000000000001",
    revision: 1,
    code: "OV-012:check:2026-01-15",
    point: "40000000-0000-4000-8000-000000000001",
    action: "check",
    date: "2026-01-15",
    category: null,
    source: null,
    protocol: null,
    target: 40,
    ...overrides,
  };
}
function producerAllocation() {
  const row = producerTask();
  return {
    id: row.quadrant_id,
    kind: "quadrant_assignment",
    quadrant_id: row.quadrant_id,
    courier: row.courier,
    revision: 1,
  };
}
void test("Review2 producer: real bootstrap and delta rows preserve unlocated tasks without allocation noise", async () => {
  const fixture = await dayFixture();
  await fixture.store.replace(bundle([producerAllocation(), producerTask()]), FIXED_NOW);
  let cached = await fixture.store.read();
  assert.equal(cached.meta?.unreadable_rows, 0);
  assert.equal(cached.tasks.length, 1);
  assert.equal(cached.tasks[0]?.task.point_code, "OV-012:check:2026-01-15");
  assert.equal(findAssignedTaskByPointCode("OV-012", cached.tasks)?.point_id, producerTask().point);
  assert.equal(cached.tasks[0].task.point_id, producerTask().point);
  assert.equal(cached.tasks[0].task.version, "1");
  assert.equal(cached.tasks[0].task.lat, undefined);
  const row = producerTask({ category: "high", revision: 2 });
  await fixture.service.applyProjectionChanges({
    assignments: [
      {
        ...change("upsert", 2),
        resource_type: "quadrant_assignment",
        resource_id: row.quadrant_id,
        data: producerAllocation(),
      },
      {
        ...change("upsert", 3),
        resource_type: "task",
        resource_id: row.id,
        resource_version: "risk-content-hash",
        data: row,
      },
      {
        ...change("upsert", 4),
        resource_type: "task",
        resource_id: "10000000-0000-4000-8000-000000000002",
        data: producerTask({
          id: "10000000-0000-4000-8000-000000000002",
          code: "OV-001:check:2026-01-15",
        }),
      },
    ],
  });
  cached = await fixture.store.read();
  assert.equal(cached.meta?.unreadable_rows, 0);
  const day = buildDay({
    tasks: cached.tasks,
    work: [],
    location: {
      kind: "granted",
      fix: { lat: 19.4, lng: -99.1, accuracy_m: 5, fixedAt: FIXED_NOW.getTime() },
    },
    now: FIXED_NOW,
  });
  assert.deepEqual(
    day.tasks.map((entry) => entry.task.point_code),
    ["OV-012:check:2026-01-15", "OV-001:check:2026-01-15"],
  );
  assert.ok(day.tasks.every((entry) => entry.distanceM === null));
  assert.equal(mapTasks(day.tasks).length, 0);
  assert.ok(day.tasks.every((entry) => !hasCoordinates(entry.task)));
  assert.equal(day.completed, 0);
  await fixture.service.applyProjectionChanges({
    assignments: [{ ...change("remove", 5), resource_type: "task", resource_id: row.id }],
  });
  assert.equal((await fixture.store.read()).tasks.length, 1);
});

void test("Review2 retention: only captures enrolled in the retained view can keep its original payload visible", async () => {
  const fixture = await dayFixture();
  await fixture.store.replace(bundle([task({ ovitrap_id: "trap-1" })]), FIXED_NOW);
  const first = makeEnvelope({ payload: { ovitrap_id: "trap-1" } });
  await fixture.outbox.enqueue(first);
  await fixture.service.applyProjectionChanges({
    assignments: [change("upsert", 2, task({ version: 2, ovitrap_id: "trap-1" }))],
  });
  assert.equal((await fixture.store.read()).tasks[0]?.task.version, "1");
  // This capture was made while the old task view still applied; it also keeps that view.
  const duringRetention = makeEnvelope({ payload: { ovitrap_id: "trap-1" } });
  await fixture.outbox.enqueue(duringRetention);
  await fixture.outbox.claimPending(1);
  await fixture.outbox.settle([
    { id: first.id, action: "accept", result: { code: "accepted", params: {} } },
  ]);
  assert.equal((await fixture.store.read()).tasks[0]?.task.version, "1");
  await fixture.outbox.claimPending(1);
  await fixture.outbox.settle([
    { id: duringRetention.id, action: "accept", result: { code: "accepted", params: {} } },
  ]);
  assert.equal((await fixture.store.read()).tasks[0]?.task.version, "2");
  await fixture.outbox.enqueue(makeEnvelope({ payload: { ovitrap_id: "trap-1" } }));
  const latest = (await fixture.store.read()).tasks[0];
  assert.equal(latest?.task.version, "2");
  assert.equal(latest.isKept, false);
});

void test("Review2 revocation: failed reload cannot leave the previous snapshot or map visible", async () => {
  const fixture = await dayFixture();
  const day = createTestDay(fixture);
  await day.verifyMap();
  let canRead = true;
  const view = new DayViewController({
    bundle: fixture.service,
    verifyMap: () => day.verifyMap(),
    read: () => (canRead ? day.read() : Promise.reject(new Error("storage read failed"))),
  });
  view.start();
  await view.load();
  assert.equal(view.getSnapshot().state?.map.kind, "ready");
  canRead = false;
  const clearing = fixture.service.clearSessionData();
  assert.equal(view.getSnapshot().state, null);
  await clearing;
  await view.load();
  assert.equal(view.getSnapshot().state, null);
  assert.ok(view.getSnapshot().errors.read);
  view.stop();
});

void test("Review2 final receipt: cleanup failure cannot discard revoked200 results and restart retries cleanup", async () => {
  const fixture = await authDayFixture();
  const event = makeEnvelope({ payload: { task_id: "task-1" } });
  await fixture.outbox.enqueue(event);
  await fixture.service.applyProjectionChanges({
    assignments: [change("upsert", 2, task({ version: 2, lat: 20 }))],
  });
  await fixture.db.query(
    "CREATE TRIGGER fail_receipt_projection_update BEFORE UPDATE ON day_assignment BEGIN SELECT RAISE(ABORT,'projection unavailable'); END",
  );
  await fixture.navigation.select("task-1");
  const auth = new AuthController({
    ...fixture,
    randomBytes,
    now: () => FIXED_NOW.getTime(),
    hasLocalRecords: () => Promise.resolve(true),
    login: () => Promise.reject(new Error("No login")),
    fetchRules: () => Promise.resolve(null),
    clearSessionData: (shouldDefer) =>
      shouldDefer ? fixture.service.deferCleanup() : fixture.service.clearSessionData(),
  });
  await auth.load();
  const requests = new SessionRequests({
    credentials: fixture.credentials,
    isOnline: () => true,
    endSession: (hasFinalReceipt) => auth.endSession(hasFinalReceipt),
    refresh: () => Promise.reject(new Error("No refresh")),
  });
  const response = answer([accepted(event.id)]);
  assert.ok(response.ok);
  let posts = 0;
  const transport = createScopedSyncTransport({
    tokens: fixture.credentials,
    requests,
    fetch: () => {
      posts += 1;
      return Promise.resolve(jsonResponse(response.response, { isFinal: true }));
    },
  });
  await fixture.db.query(
    "CREATE TRIGGER fail_revoked_cleanup BEFORE DELETE ON day_assignment BEGIN SELECT RAISE(ABORT,'storage unavailable'); END",
  );
  await assert.rejects(
    runSyncPass(
      {
        ...fixture,
        ...fixture.service.syncHooks(),
        transport,
        deviceId: FIXED_DEVICE_ID,
        now: () => FIXED_NOW,
      },
      { batchSize: 50 },
    ),
  );
  assert.equal(posts, 1);
  const rows = await fixture.db.query("SELECT id,local_status,result_code FROM outbox_event");
  assert.equal(rows[0]?.id, event.id);
  assert.equal(rows[0].local_status, "sent");
  assert.equal(rows[0].result_code, "accepted");
  assert.notEqual(fixture.credentials.getSnapshot().pair, null);
  assert.equal(await fixture.kv.get("day_cleanup_pending"), "true");
  await fixture.db.query("DROP TRIGGER fail_revoked_cleanup");
  const restarted = new DayBundleService({
    store: new DayStore(fixture.db),
    now: () => FIXED_NOW,
    transport: () => Promise.reject(new Error("airplane")),
  });
  await restarted.retryCleanup();
  assert.equal((await restarted.read()).tasks.length, 0);
  assert.equal(await fixture.navigation.read(), null);
  assert.equal(await fixture.kv.get(KV_KEYS.syncCursor), null);
  assert.equal((await fixture.outbox.countByStatus()).sent, 1);
});

void test("Review2 scope restart: active-session offline restart cannot expose downloads whose cleanup is pending", async () => {
  const fixture = await dayFixture();
  await fixture.navigation.select("task-1");
  await fixture.db.query(
    "CREATE TRIGGER fail_scope_cleanup BEFORE DELETE ON day_assignment BEGIN SELECT RAISE(ABORT,'disk unavailable'); END",
  );
  await assert.rejects(fixture.service.clearSessionData());
  const restarted = new DayBundleService({
    store: new DayStore(fixture.db),
    now: () => FIXED_NOW,
    getScopeKey: () => "same-active-session",
    transport: () => Promise.reject(new Error("airplane")),
  });
  const day = createTestDay(fixture, restarted);
  const cached = await day.read();
  assert.equal(cached.tasks.length, 0);
  assert.equal(cached.manifests.length, 0);
  assert.equal(cached.map.kind, "unavailable");
  assert.equal(cached.navigation, null);
  await assert.rejects(day.select("task-1"));
  const evidence = await fixture.db.query("SELECT id FROM day_assignment");
  assert.equal(evidence.length, 1); // Physical cleanup really failed; hiding is not a successful delete.
});

void test("Review2 concurrent final receipt: a revoked200 upgrades ordinary cleanup already pending", async () => {
  const fixture = await authDayFixture();
  const cleanupEntered = deferred<undefined>();
  const cleanupFailure = deferred<never>();
  const upgradeRequested = deferred<undefined>();
  const uploadEntered = deferred<undefined>();
  const uploaded = deferred<Response>();
  const event = makeEnvelope();
  await fixture.outbox.enqueue(event);
  const auth = new AuthController({
    ...fixture,
    randomBytes,
    now: () => FIXED_NOW.getTime(),
    hasLocalRecords: () => Promise.resolve(true),
    login: () => Promise.reject(new Error("No login")),
    fetchRules: () => Promise.resolve(null),
    clearSessionData: async (hasFinalReceipt) => {
      await fixture.service.deferCleanup();
      if (hasFinalReceipt) return;
      cleanupEntered.resolve(undefined);
      await cleanupFailure.promise;
    },
  });
  await auth.load();
  const requests = new SessionRequests({
    credentials: fixture.credentials,
    isOnline: () => true,
    endSession: (hasFinalReceipt) => {
      if (hasFinalReceipt) upgradeRequested.resolve(undefined);
      return auth.endSession(hasFinalReceipt);
    },
    refresh: () => Promise.reject(new Error("No refresh")),
  });
  const transport = createScopedSyncTransport({
    tokens: fixture.credentials,
    requests,
    fetch: () => {
      uploadEntered.resolve(undefined);
      return uploaded.promise;
    },
  });
  const running = runSyncPass(
    {
      ...fixture,
      ...fixture.service.syncHooks(),
      transport,
      deviceId: FIXED_DEVICE_ID,
      now: () => FIXED_NOW,
    },
    { batchSize: 50 },
  );
  await uploadEntered.promise;
  const ordinary = requests.run(() =>
    Promise.resolve({
      response: new Response(null, { status: 403 }),
      error: { code: "session_revoked", detail: "Fixture" },
    }),
  );
  const ordinaryOutcome = ordinary.then(
    () => null,
    (error: unknown) => error,
  );
  await cleanupEntered.promise;
  const result = answer([accepted(event.id)]);
  assert.ok(result.ok);
  uploaded.resolve(jsonResponse(result.response, { isFinal: true }));
  await upgradeRequested.promise;
  cleanupFailure.reject(new Error("projection cleanup failed"));
  assert.match(String(await ordinaryOutcome), /projection cleanup failed/);
  assert.deepEqual(await running, {
    kind: "blocked",
    reason: "needsLogin",
    code: "session_revoked",
  });
  assert.equal((await fixture.outbox.countByStatus()).sent, 1);
  assert.equal(fixture.credentials.getSnapshot().pair, null);
});
