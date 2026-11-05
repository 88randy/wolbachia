import { ShiftSnapshotReader } from "../src/features/shift-open/use-m-04.ts";
import type { ShiftSnapshot } from "../src/features/shift-open/service.ts";
import { toOutboxEvent } from "../src/outbox/outbox-event.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { KvStore } from "../src/db/kv-store.ts";
import { OutboxRepository } from "../src/outbox/outbox-repository.ts";
import { openTestDatabase } from "./support/sqlite-executor.ts";
import { DraftBuffer } from "../src/features/shift-open/draft-buffer.ts";
import { readCatalogSnapshot } from "../src/features/shift-open/catalog-snapshot.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ShiftOpenService } from "../src/features/shift-open/service.ts";
import { departureGate, deliveryKey, isMapReady } from "../src/features/shift-open/domain.ts";
import type { MapPreparation } from "../src/features/shift-open/domain.ts";
import { ShiftOpenStore } from "../src/features/shift-open/store.ts";
import { OutboxWriteError } from "../src/outbox/outbox-repository.ts";
import { SyncEngine } from "../src/sync/sync-engine.ts";
import { createStores, FIXED_NOW, FIXED_DEVICE_ID, makeEnvelope } from "./support/factories.ts";
import type { TestStores } from "./support/factories.ts";
import { accepted, answer, scriptedTransport } from "./support/scripted-transport.ts";

const ASSET = { id: "C-07.pmtiles", license: "licensed", size: 10, sha256: "hash" };
const VERIFIED = {
  id: "C-07.pmtiles",
  fileRef: "file:///maps/C-07.pmtiles",
  size: 10,
  sha256: "hash",
};
const READY: MapPreparation = {
  status: "ready",
  version: "map-v1",
  coverage: ["C-07"],
  requiredCoverage: ["C-07"],
  assets: [ASSET],
  verifiedAssets: [VERIFIED],
  progress: 100,
  error: null,
};
const ITEM = {
  code: "brakes",
  label_es: "Frenos",
  label_en: "Brakes",
  is_other: false,
  requires_photo: false,
};
const ITEMS = [ITEM];
function engineFor(
  stores: TestStores,
  transport = scriptedTransport([answer([])]).transport,
  hasSession = false,
) {
  return new SyncEngine({
    pass: { ...stores, deviceId: FIXED_DEVICE_ID, now: () => FIXED_NOW, transport },
    hasSession: () => hasSession,
    hasPendingFinalUpload: () => Promise.resolve(false),
    hasServer: () => true,
    random: () => 0,
    schedule: () => () => undefined,
    report: () => undefined,
  });
}
async function harness(
  stores?: TestStores,
  overrides: Partial<ConstructorParameters<typeof ShiftOpenService>[0]> = {},
) {
  const local = stores ?? (await createStores());
  const store = new ShiftOpenStore(local.db);
  await store.saveCatalog({ version: "catalog-v1", items: ITEMS });
  let sequence = 0;
  const engine = engineFor(local);
  const service = new ShiftOpenService({
    store,
    engine,
    now: () => FIXED_NOW,
    uuid: () => `11111111-1111-4111-8111-${String(++sequence).padStart(12, "0")}`,
    maps: {
      prepare: async (publish) => {
        await publish(READY);
        return READY;
      },
    },
    photos: { capture: () => Promise.resolve({ status: "unavailable" }) },
    ...overrides,
  });
  return { ...local, store, service, engine };
}
async function prepare(service: ShiftOpenService) {
  await service.start();
  await service.update({ motorcycle_code: "M-03", step: "checklist" });
  await service.update({
    checks: [{ item: "brakes", result: "ok" }],
    odometer_km: "12480",
    step: "maps",
  });
  await service.prepareMap();
}
void test("AC flow: restart preserves step and UUID; commit precedes navigation and double opening creates one event", async () => {
  const directory = mkdtempSync(join(tmpdir(), "wolbachia-m04-"));
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
  const path = join(directory, "phone.sqlite");
  let handle = await openTestDatabase(path);
  const storesFor = (): TestStores => ({
    db: handle.executor,
    kv: new KvStore(handle.executor),
    outbox: new OutboxRepository(handle.executor, () => FIXED_NOW),
  });
  try {
    const first = await harness(storesFor());
    assert.equal((await first.service.read()).draft, null);
    await prepare(first.service);
    const captured = (await first.service.read()).draft;
    assert.ok(captured);
    await first.engine.requestSync();
    handle.close();
    handle = await openTestDatabase(path);
    const restarted = await harness(storesFor());
    assert.deepEqual((await restarted.service.read()).draft, captured);
    const saved = await restarted.service.open();
    assert.ok(saved.draft);
    assert.equal(saved.draft.clientShiftId, captured.clientShiftId);
    assert.equal(saved.opening?.envelope.shift_id, captured.clientShiftId);
    assert.equal(saved.opening.envelope.device_time, FIXED_NOW.toISOString());
    await Promise.all([
      restarted.service.open(),
      restarted.service.start(),
      restarted.service.open(),
    ]);
    await restarted.engine.requestSync();
    assert.equal((await restarted.outbox.countByStatus()).pending, 1);
    handle.close();
    handle = await openTestDatabase(path);
    assert.equal(
      (await (await harness(storesFor())).service.read()).opening?.envelope.id,
      captured.openingEventId,
    );
  } finally {
    handle.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
void test("AC safety: missing/empty checklist, unanswered/Other and missing maps block capture", async () => {
  const { service, store } = await harness();
  await prepare(service);
  const state = await service.read();
  assert.ok(state.draft);
  const draft = state.draft;
  assert.equal(departureGate({ draft, catalog: null, map: READY }), "unconfigured");
  assert.equal(
    departureGate({ draft, catalog: { version: "catalog-v1", items: [] }, map: READY }),
    "unconfigured",
  );
  assert.equal(
    departureGate({ draft: { ...draft, checks: [] }, catalog: state.catalog, map: READY }),
    "checklist",
  );
  assert.equal(
    departureGate({
      draft,
      catalog: { version: "catalog-v1", items: [{ ...ITEM, is_other: true }] },
      map: READY,
    }),
    "note",
  );
  await store.saveMap({ ...READY, status: "unavailable" });
  await assert.rejects(service.open(), /map/);
  assert.equal((await service.read()).opening, null);
});
void test("AC severe: enqueue opening but prohibit departure, including after restart", async () => {
  const local = await harness();
  await prepare(local.service);
  await local.service.update({
    checks: [{ item: "brakes", result: "severe", note: "Brake failure" }],
  });
  const saved = await local.service.open();
  assert.equal(saved.canDepart, false);
  assert.equal(saved.gate, "severe");
  assert.equal(saved.opening?.envelope.type, "shift.open");
  assert.equal((await (await harness(local)).service.read()).gate, "severe");
});
void test("AC odometer: decrease warns without discarding input or blocking capture", async () => {
  const { service, outbox } = await harness();
  await outbox.enqueue(
    makeEnvelope({ type: "shift.open", payload: { motorcycle_code: "M-03", odometer_km: 13000 } }),
  );
  await prepare(service);
  assert.equal((await service.read()).hasOdometerWarning, true);
  assert.equal((await service.read()).draft?.odometer_km, "12480");
  assert.equal((await service.open()).opening?.envelope.payload.odometer_km, 12480);
});
void test("AC map: Ready requires coverage and licensed files matching manifest size/hash", () => {
  assert.equal(isMapReady(READY), true);
  for (const map of [
    { ...READY, verifiedAssets: [] },
    { ...READY, coverage: [] },
    { ...READY, assets: [] },
    { ...READY, assets: [{ ...ASSET, license: "" }] },
    { ...READY, verifiedAssets: [{ ...VERIFIED, size: 9 }] },
    { ...READY, verifiedAssets: [{ ...VERIFIED, sha256: "wrong" }] },
    { ...READY, error: "network" },
    { ...READY, status: "failed" as const },
  ])
    assert.equal(isMapReady(map), false);
});
void test("AC storage: atomic failure retains draft and never presents saved", async () => {
  const local = await harness();
  await prepare(local.service);
  await local.db.runAtomically([
    {
      sql: `CREATE TRIGGER fail_projection BEFORE UPDATE OF opening_event_id ON shift_open_state
    BEGIN SELECT RAISE(ABORT, 'disk full after outbox insert'); END`,
    },
  ]);
  await assert.rejects(local.service.open(), OutboxWriteError);
  assert.equal((await local.service.read()).opening, null);
  assert.equal((await local.outbox.countByStatus()).pending, 0);
  assert.ok((await local.service.read()).draft);
});
void test("AC offline: retry sends original UUID once; pending/error never claims receipt", async () => {
  const local = await harness();
  await prepare(local.service);
  const saved = await local.service.open();
  assert.ok(saved.opening);
  assert.equal(deliveryKey(saved.opening), "mobile.shiftOpen.phoneSaved");
  const restarted = await harness(local);
  assert.ok(saved.draft);
  const script = scriptedTransport([answer([accepted(saved.opening.envelope.id)]), answer([])]);
  const engine = engineFor(restarted, script.transport, true);
  await engine.start();
  await engine.requestSync();
  assert.deepEqual(
    script.requests.flatMap((request) => request.events.map((event) => event.shift_id)),
    [saved.draft.clientShiftId],
  );
  const received = (await restarted.service.read()).opening;
  assert.ok(received);
  assert.equal(deliveryKey(received), "mobile.shiftOpen.serverReceived");
  assert.equal(deliveryKey({ ...received, status: "error" }), "mobile.shiftOpen.phoneSaved");
});
void test("AC blocked: server motorcycle rejection stops departure and retains truthful outcome", async () => {
  const localBlock = await harness();
  await prepare(localBlock.service);
  await localBlock.service.update({ motorcycle_code: " M-03 " });
  await localBlock.service.update({ checks: [{ item: "brakes", result: "ok" }] });
  await localBlock.store.saveCatalog({
    version: "catalog-v1",
    items: ITEMS,
    blockedMotorcycles: ["M-03"],
  });
  assert.equal((await localBlock.service.read()).gate, "motorcycle");
  await assert.rejects(localBlock.service.open(), /motorcycle/);
  for (const code of ["motorcycle_unknown", "motorcycle_blocked", "motorcycle_in_use"]) {
    const local = await harness();
    await prepare(local.service);
    const saved = await local.service.open();
    assert.ok(saved.opening);
    await local.engine.requestSync();
    await local.outbox.claimPending(1);
    await local.outbox.settle([
      { id: saved.opening.envelope.id, action: "reject", result: { code, params: {} } },
    ]);
    const rejected = await local.service.read();
    assert.equal(rejected.canDepart, false);
    assert.equal(rejected.opening?.result?.code, code);
  }
});

void test("AC recovery: failed field writes survive sync refresh and retry without losing input", async () => {
  const local = await harness();
  await prepare(local.service);
  let shouldFail = true;
  const failingDb = {
    ...local.db,
    runAtomically: (statements: Parameters<typeof local.db.runAtomically>[0]) => {
      if (
        shouldFail &&
        statements.some((statement) => statement.sql.startsWith("UPDATE shift_open_state"))
      )
        return Promise.reject(new Error("disk full"));
      return local.db.runAtomically(statements);
    },
  };
  const restarted = await harness({ ...local, db: failingDb });
  const buffer = new DraftBuffer();
  buffer.edit({ odometer_km: "123" });
  await assert.rejects(buffer.persist(restarted.service), OutboxWriteError);
  assert.equal(buffer.merge(await restarted.service.read()).draft?.odometer_km, "123");
  shouldFail = false;
  await buffer.persist(restarted.service);
  assert.equal((await (await harness(local)).service.read()).draft?.odometer_km, "123");
});
void test("AC safety: switching motorcycles requires a new checklist and evidence, retaining UUID and raw odometer", async () => {
  const { service } = await harness();
  await prepare(service);
  const original = await service.read();
  await service.update({ motorcycle_code: "M-07" });
  const changed = await service.read();
  assert.ok(changed.draft);
  assert.deepEqual(changed.draft.checks, []);
  assert.deepEqual(changed.draft.photoRefs, []);
  assert.equal(changed.draft.clientShiftId, original.draft?.clientShiftId);
  assert.equal(changed.draft.odometer_km, "12480");
  await assert.rejects(service.open(), /checklist/);
});
void test("AC evidence: catalog changes never silently discard a captured severe result", async () => {
  const { service, store } = await harness();
  await prepare(service);
  await service.update({ checks: [{ item: "brakes", result: "severe", note: "Brake failure" }] });
  await store.saveCatalog({ version: "catalog-v2", items: [{ ...ITEM, code: "lights" }] });
  await assert.rejects(service.open(), /catalogChanged/);
  await assert.rejects(service.confirmCatalog(), /evidence/);
  assert.equal((await service.read()).draft?.checks[0]?.result, "severe");
  assert.equal((await service.read()).opening, null);
});
void test("AC map recovery: progress is durable before completion and a failed attempt can resume", async () => {
  const local = await harness();
  await local.service.start();
  let resume: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    resume = resolve;
  });
  let reached: (() => void) | undefined;
  const progressStored = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const partial = { ...READY, status: "preparing" as const, progress: 50 };
  const download = await harness(local, {
    maps: {
      prepare: async (publish) => {
        await publish(partial);
        reached?.();
        await held;
        throw new Error("network unavailable");
      },
    },
  });
  const work = download.service.prepareMap();
  await progressStored;
  assert.equal((await local.store.map())?.progress, 50);
  resume?.();
  await work;
  assert.equal((await local.store.map())?.status, "failed");
  assert.equal((await local.store.map())?.progress, 50);
  const restarted = await harness(local, {
    maps: {
      prepare: (_publish, previous) => {
        assert.equal(previous?.progress, 50);
        return Promise.resolve(READY);
      },
    },
  });
  assert.equal(isMapReady((await restarted.service.prepareMap()).map), true);
});
void test("AC catalog: persisted ACTIVE snapshot controls requirements; malformed/empty snapshots cannot enable departure", async () => {
  const local = await harness();
  const catalog = readCatalogSnapshot({
    version: "downloaded",
    catalogs: [{ slug: "motorcycle-check-item", items: [ITEM] }],
  });
  await local.store.saveCatalog(catalog);
  const reopened = new ShiftOpenStore(local.db);
  assert.equal((await reopened.catalog())?.items[0]?.code, "brakes");
  assert.equal(readCatalogSnapshot({ version: "empty", catalogs: [] }).items.length, 0);
  assert.throws(
    () =>
      readCatalogSnapshot({
        version: "bad",
        catalogs: [{ slug: "motorcycle-check-item", items: [{}] }],
      }),
    /Malformed/,
  );
});

void test("AC storage: a failed count refresh after commit cannot report the opening as unsaved", async () => {
  const local = await createStores();
  let shouldFail = false;
  const db = {
    ...local.db,
    query: (sql: string, params?: readonly import("../src/db/sql.ts").SqlValue[]) => {
      if (shouldFail && sql.includes("COUNT(*) AS total")) {
        shouldFail = false;
        return Promise.reject(new Error("read failed after commit"));
      }
      return local.db.query(sql, params);
    },
  };
  const outbox = new OutboxRepository(db, () => FIXED_NOW);
  const { service, engine } = await harness({ ...local, outbox });
  await prepare(service);
  shouldFail = true;
  const saved = await service.open();
  await engine.requestSync();
  assert.ok(saved.opening);
  assert.equal(deliveryKey(saved.opening), "mobile.shiftOpen.phoneSaved");
  assert.equal((await outbox.countByStatus()).pending, 1);
});

void test("Regression: explicit correction after rejection creates new UUIDs and preserves the rejected envelope", async () => {
  const local = await harness();
  await prepare(local.service);
  await local.service.update({ motorcycle_code: "M-typo" });
  await local.service.update({ checks: [{ item: "brakes", result: "ok" }] });
  const original = await local.service.open();
  assert.ok(original.opening);
  const oldEnvelope = structuredClone(original.opening.envelope);
  await local.engine.requestSync();
  await local.outbox.claimPending(1);
  await local.outbox.settle([
    { id: oldEnvelope.id, action: "reject", result: { code: "motorcycle_unknown", params: {} } },
  ]);
  let nextUuid = 2;
  const restarted = await harness(local, {
    uuid: () => `11111111-1111-4111-8111-${String(++nextUuid).padStart(12, "0")}`,
  });
  assert.equal((await restarted.service.start()).opening?.status, "rejected");
  await restarted.service.update({ motorcycle_code: "M-07" });
  assert.equal((await restarted.service.read()).draft?.motorcycle_code, "M-typo");
  const attempt = await restarted.service.restartRejected();
  assert.ok(attempt.draft);
  assert.equal(attempt.opening, null);
  assert.notEqual(attempt.draft.clientShiftId, oldEnvelope.shift_id);
  assert.notEqual(attempt.draft.openingEventId, oldEnvelope.id);
  assert.equal(attempt.draft.step, "motorcycle");
  assert.equal(attempt.draft.motorcycle_code, "");
  assert.deepEqual(attempt.draft.checks, []);
  assert.deepEqual((await local.service.start()).draft, attempt.draft);
  await prepare(restarted.service);
  const corrected = await restarted.service.open();
  assert.equal(corrected.opening?.envelope.payload.motorcycle_code, "M-03");
  assert.equal(corrected.opening.envelope.id, attempt.draft.openingEventId);
  const script = scriptedTransport([answer([accepted(attempt.draft.openingEventId)]), answer([])]);
  const engine = engineFor(local, script.transport, true);
  await engine.start();
  await engine.requestSync();
  assert.deepEqual(
    script.requests.flatMap((request) => request.events.map((event) => event.id)),
    [attempt.draft.openingEventId],
  );
  const [rejected] = await local.db.query("SELECT * FROM outbox_event WHERE id = ?", [
    oldEnvelope.id,
  ]);
  assert.ok(rejected);
  const retained = toOutboxEvent(rejected);
  assert.equal(retained.status, "rejected");
  assert.deepEqual(retained.envelope, oldEnvelope);
});

void test("Regression: correction cannot replace an opening without a server rejection", async () => {
  for (const outcome of ["pending", "sending", "sent", "in_review", "error"] as const) {
    const local = await harness();
    await prepare(local.service);
    const original = await local.service.open();
    assert.ok(original.opening);
    await local.engine.requestSync();
    if (outcome !== "pending") await local.outbox.claimPending(1);
    if (outcome === "sent" || outcome === "in_review")
      await local.outbox.settle([
        {
          id: original.opening.envelope.id,
          action: outcome === "sent" ? "accept" : "review",
          result: { code: outcome === "sent" ? "accepted" : "clock_skew", params: {} },
        },
      ]);
    if (outcome === "error")
      await local.outbox.settle([
        { id: original.opening.envelope.id, action: "failPermanent", lastError: "invalid_payload" },
      ]);
    const before = await local.service.read();
    assert.equal(before.opening?.status, outcome);
    await assert.rejects(
      local.db.runAtomically([
        { sql: "UPDATE shift_open_state SET opening_event_id = NULL WHERE slot = 1" },
      ]),
      /captured shift is immutable/,
    );
    assert.deepEqual(await local.service.restartRejected(), before);
  }
});

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

void test("Regression: reversed refresh completion retains the newer server rejection", async () => {
  const local = await harness();
  await prepare(local.service);
  const pending = await local.service.open();
  assert.ok(pending.opening);
  const staleRead = deferred<ShiftSnapshot>();
  const latestRead = deferred<ShiftSnapshot>();
  const reads = [staleRead, latestRead];
  const service = {
    read: () => {
      const next = reads.shift();
      assert.ok(next);
      return next.promise;
    },
  };
  const reader = new ShiftSnapshotReader(new DraftBuffer());
  const published: ShiftSnapshot[] = [];
  const publish = (snapshot: ShiftSnapshot) => {
    published.push(snapshot);
  };
  const stale = reader.refresh(service, publish);
  await local.engine.requestSync();
  await local.outbox.claimPending(1);
  await local.outbox.settle([
    {
      id: pending.opening.envelope.id,
      action: "reject",
      result: { code: "motorcycle_unknown", params: {} },
    },
  ]);
  const latest = reader.refresh(service, publish);
  latestRead.resolve(await local.service.read());
  await latest;
  staleRead.resolve(pending);
  await stale;
  assert.equal(published.at(-1)?.opening?.status, "rejected");
  assert.equal(published.at(-1)?.opening?.result?.code, "motorcycle_unknown");
  assert.equal(published.at(-1)?.canDepart, false);
  assert.equal(published.length, 1);
});

void test("Regression: refresh cannot publish after an edit or unmount invalidation", async () => {
  const local = await harness();
  await prepare(local.service);
  const snapshot = await local.service.read();
  for (const guard of ["edit", "unmount"] as const) {
    const buffer = new DraftBuffer();
    const reader = new ShiftSnapshotReader(buffer);
    const pending = deferred<ShiftSnapshot>();
    const published: ShiftSnapshot[] = [];
    const refresh = reader.refresh({ read: () => pending.promise }, (saved) => {
      published.push(saved);
    });
    if (guard === "edit") buffer.edit({ odometer_km: "12500" });
    else reader.invalidate();
    pending.resolve(snapshot);
    await refresh;
    assert.equal(published.length, 0, guard);
  }
});
