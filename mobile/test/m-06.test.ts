import { locationMessage } from "../src/features/day/location-presentation.ts";
import { scheduleDueRefresh } from "../src/features/day/due-refresh.ts";
import { createScopedSyncTransport } from "../src/sync/scoped-sync-transport.ts";
import { randomUUID } from "node:crypto";
import { createLinkingLauncher } from "../src/navigation/linking-launcher.ts";
import { DayService } from "../src/features/day/service.ts";
import { ShiftOpenStore } from "../src/features/shift-open/store.ts";
import { refreshDay } from "../src/features/day/refresh-day.ts";
import { createMobileApiClient } from "../src/api/create-api-client.ts";
import { createMemoryTokenStore } from "../src/auth/token-store.ts";
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
import { parseAssignment } from "../src/features/day/assignment-parser.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { DayStore } from "../src/features/day/store.ts";
import { DayBundleService } from "../src/features/day/bundle-service.ts";
import { buildDay } from "../src/features/day/domain.ts";
import { NavigationService } from "../src/navigation/navigation-service.ts";
import { createStores, makeEnvelope, FIXED_NOW } from "./support/factories.ts";

const task = (overrides = {}) => ({
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
  assert.equal(latest.task.status, "done");
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
  assert.equal(day.reviewed, 0);
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
    baseUrl: "https://field.example.test",
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
      baseUrl: "https://field.example.test",
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

void test("Regression: stale sync responses from a prior token or server cannot install projections", async () => {
  for (const changed of ["token", "server"] as const) {
    const tokens = createMemoryTokenStore();
    tokens.setAccessToken(randomUUID());
    let baseUrl = "https://first.example.test";
    const response = deferred<Response>();
    const entered = deferred<undefined>();
    const transport = createScopedSyncTransport({
      baseUrl: () => baseUrl,
      tokens,
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
    if (changed === "token") tokens.setAccessToken(randomUUID());
    else baseUrl = "https://second.example.test";
    const success = answer([]);
    assert.ok(success.ok);
    response.resolve(
      new Response(JSON.stringify(success.response), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    assert.deepEqual(await pending, { ok: false, failure: { kind: "network" } });
  }
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
  await store.replace(
    bundle([
      task({ point_code: "OV-010", lat: 50 }),
      task({ id: "far", point_code: "OV-001", risk: "normal", lat: 1, lng: 1 }),
      task({ id: "near", point_code: "OV-999", risk: "normal", lat: 0, lng: 0 }),
    ]),
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
  const transport = createScopedSyncTransport({
    baseUrl: () => "https://field.example.test",
    tokens: createMemoryTokenStore(),
    fetch: () => {
      requests += 1;
      return Promise.resolve(
        new Response(JSON.stringify(final.response), {
          headers: { "Content-Type": "application/json", "X-Session-Revoked": "true" },
        }),
      );
    },
  });
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
