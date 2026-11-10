import assert from "node:assert/strict";
import { test } from "node:test";
import { setStatement } from "../src/db/kv-store.ts";
import { DayStore } from "../src/features/day/store.ts";
import {
  sampleBundleStatements,
  sampleChangeStatements,
  needsSampleBootstrap,
  readSampleProjection,
} from "../src/features/samples/projection.ts";
import {
  PROJECTION_IDENTITY,
  projectionBundle,
  projectionChanges,
} from "./support/lifecycle-projection-fixtures.ts";
import { CONTRACT_IDS } from "./support/lifecycle-contract-fixtures.ts";
import { createStores } from "./support/factories.ts";
import {
  SAMPLE_NOW,
  sampleBundle,
  sampleCatalog,
  sampleProfile,
  sampleSnapshot,
  sampleSource,
} from "./support/sample-fixtures.ts";

async function setup() {
  const { db } = await createStores(),
    store = new DayStore(db);
  const original = await store.captureTransport(PROJECTION_IDENTITY, () => true);
  await store.replace(sampleBundle(), SAMPLE_NOW, original);
  const handle = await store.captureTransport(PROJECTION_IDENTITY, () => true);
  assert.ok(handle);
  await db.runAtomically([
    setStatement("session_profile", JSON.stringify(sampleProfile())),
    setStatement("shift_open_catalog", JSON.stringify(sampleCatalog())),
    setStatement("shift_open_rules", JSON.stringify({ version: "rules-sample-v1" })),
  ]);
  return { db, store, handle };
}
void test("sample readiness distinguishes known unavailable from missing legacy metadata and changes never bootstrap", async () => {
  const { db, handle } = await setup();
  await db.runAtomically(sampleBundleStatements(projectionBundle(), handle));
  assert.equal(await needsSampleBootstrap(db), true);
  await db.runAtomically(
    sampleChangeStatements(projectionChanges({ sample_capture: sampleSnapshot() }), handle),
  );
  await assert.rejects(readSampleProjection(db, handle));
  await db.runAtomically(
    sampleBundleStatements({ ...sampleBundle(), sample_capture: null }, handle),
  );
  assert.equal(await needsSampleBootstrap(db), false);
  await assert.rejects(readSampleProjection(db, handle));
  await db.runAtomically(sampleBundleStatements(sampleBundle(), handle));
  assert.equal((await readSampleProjection(db, handle)).snapshot.methods.length, 1);
  await db.runAtomically(
    sampleChangeStatements(projectionChanges({ sample_capture: null }), handle),
  );
  await assert.rejects(readSampleProjection(db, handle));
  assert.equal(await needsSampleBootstrap(db), false);
});
void test("sample raw authority CAS includes profile catalog and snapshot and never unions mismatched scope pairs", async () => {
  const { db, handle } = await setup();
  const snapshot = sampleSnapshot({
    sources: [
      sampleSource(),
      { ...sampleSource(), id: CONTRACT_IDS.otherCenter, center_id: CONTRACT_IDS.otherCenter },
    ],
  });
  await db.runAtomically(
    sampleBundleStatements({ ...sampleBundle(), sample_capture: snapshot }, handle),
  );
  const source = await readSampleProjection(db, handle);
  assert.deepEqual(source.snapshot.sources, [sampleSource()]);
  assert.equal((await db.query(source.guard.sql, source.guard.params)).length, 1);
  await db.runAtomically([
    setStatement(
      "shift_open_catalog",
      JSON.stringify({ ...sampleCatalog(), version: "catalog-new" }),
    ),
  ]);
  assert.equal((await db.query(source.guard.sql, source.guard.params)).length, 0);
  const fresh = await readSampleProjection(db, handle);
  await db.runAtomically([
    setStatement(
      "session_profile",
      JSON.stringify({ ...sampleProfile(), permissions: ["field_event.sync"] }),
    ),
  ]);
  assert.equal((await db.query(fresh.guard.sql, fresh.guard.params)).length, 0);
  await assert.rejects(readSampleProjection(db, handle));
});
void test("sample malformed or foreign complete snapshots clear prior positive without affecting day assignment cache", async () => {
  const { db, store, handle } = await setup();
  const own = await store.read();
  for (const snapshot of [
    sampleSnapshot({ user_id: CONTRACT_IDS.otherCenter }),
    { ...sampleSnapshot(), schema_version: 2 },
    { ...sampleSnapshot(), methods: [{ id: CONTRACT_IDS.source }] },
  ]) {
    await db.runAtomically(
      sampleBundleStatements({ ...sampleBundle(), sample_capture: snapshot }, handle),
    );
    assert.equal(await needsSampleBootstrap(db), true);
    await assert.rejects(readSampleProjection(db, handle));
    assert.deepEqual(await store.read(), own);
  }
});
