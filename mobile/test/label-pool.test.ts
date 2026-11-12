import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findPoolLabel,
  LabelPoolStore,
  normalizeLabelCode,
  readLabelPool,
} from "../src/features/ovitrap-check/label-pool.ts";
import { currentEventId, harness } from "./support/m-08-harness.ts";

const ID = "77777777-7777-4777-8777-777777777777";
const POOL = [{ id: ID, code: "OVT-0001" }];

void test("a typed code is canonical in any case, with or without dash and zeros", () => {
  for (const typed of ["OVT-0001", "ovt-0001", "Ovt1", " OVT-01 ", "OVT00001"])
    assert.equal(normalizeLabelCode(typed), "OVT-0001", typed);
  assert.equal(normalizeLabelCode("ovt-10000"), "OVT-10000");
});

void test("only an unambiguous short code is accepted", () => {
  for (const typed of [
    "",
    "1",
    "0001",
    "OVT",
    "OVT-",
    "OVT-0",
    "OVT-0000",
    "OVT-1A",
    "XOVT-1",
    "OV-010",
  ])
    assert.equal(normalizeLabelCode(typed), null, typed);
});

void test("the pool finds a label by its normalized code and nothing else", () => {
  assert.equal(findPoolLabel(POOL, "ovt1")?.id, ID);
  assert.equal(findPoolLabel(POOL, "OVT-0002"), null);
  assert.equal(findPoolLabel(POOL, ID), null);
});

void test("a malformed server pool is refused whole", () => {
  assert.throws(() => readLabelPool({}));
  assert.throws(() => readLabelPool({ labels: [{ id: "nope", code: "OVT-0001" }] }));
  assert.throws(() => readLabelPool({ labels: [{ id: ID, code: "OVT-1" }] }));
  assert.deepEqual(readLabelPool({ labels: [{ id: ID.toUpperCase(), code: "OVT-0001" }] }), POOL);
});

void test("the pool survives on the phone for offline use", async () => {
  const { db } = await harness();
  const store = new LabelPoolStore(db);
  assert.deepEqual(await store.read(), []);
  await store.save(POOL);
  assert.deepEqual(await new LabelPoolStore(db).read(), POOL);
  await store.save([]);
  assert.deepEqual(await store.read(), []);
});

void test("a typed short code resolves offline through the downloaded pool", async () => {
  const h = await harness(undefined, { labelPool: () => Promise.resolve(POOL) });
  await h.service.startPlace(await currentEventId(h.store));
  const eventId = await currentEventId(h.store);
  for (const typed of ["OVT-0001", "ovt-0001", " ovt1 ", "OVT0001", "OVT-01"]) {
    assert.equal(await h.service.bindLabel(typed, true, eventId), "read", typed);
    const draft = (await h.store.read()).draft;
    assert.ok(draft);
    assert.equal(draft.ovitrapId, ID);
    assert.equal(draft.labelScanned, true);
    assert.equal(draft.manualCapture, true);
  }
});

void test("a short code the phone does not know is refused with its own result", async () => {
  const h = await harness(undefined, { labelPool: () => Promise.resolve(POOL) });
  await h.service.startPlace(await currentEventId(h.store));
  const before = (await h.store.read()).draft?.ovitrapId;
  const eventId = await currentEventId(h.store);
  assert.equal(await h.service.bindLabel("OVT-0002", true, eventId), "unknown");
  assert.equal((await h.store.read()).draft?.ovitrapId, before);
});

void test("without a downloaded pool a typed short code is unknown, not a crash", async () => {
  const h = await harness();
  await h.service.startPlace(await currentEventId(h.store));
  assert.equal(
    await h.service.bindLabel("OVT-0001", true, await currentEventId(h.store)),
    "unknown",
  );
});

void test("a short code that was not typed by hand is not a QR", async () => {
  const h = await harness(undefined, { labelPool: () => Promise.resolve(POOL) });
  await h.service.startPlace(await currentEventId(h.store));
  assert.equal(
    await h.service.bindLabel("OVT-0001", false, await currentEventId(h.store)),
    "invalid",
  );
});
