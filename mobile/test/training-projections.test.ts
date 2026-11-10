import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { DayStore } from "../src/features/day/store.ts";
import { DayBundleService } from "../src/features/day/bundle-service.ts";
import { OutboxRepository } from "../src/outbox/outbox-repository.ts";
import { setStatement } from "../src/db/kv-store.ts";
import type { SqlExecutor } from "../src/db/sql.ts";
import {
  readTrainingSource,
  saveTrainingRecords,
  clearTrainingProjectionForSource,
} from "../src/features/training/projection-state.ts";
import { readCertification, readEvaluation } from "../src/features/training/contract.ts";
import { qualificationForAction } from "../src/features/training/domain.ts";
import { createStores, makeEnvelope } from "./support/factories.ts";
import { openTestDatabase } from "./support/sqlite-executor.ts";
import {
  PROJECTION_IDENTITY,
  PROJECTION_NOW,
  projectionBundle,
  projectionChanges,
} from "./support/lifecycle-projection-fixtures.ts";
import { CONTRACT_IDS } from "./support/lifecycle-contract-fixtures.ts";
import {
  trainingEligibility,
  trainingCertificate,
  trainingEvaluation,
} from "./training-fixtures.ts";

const PROFILE = {
  issuer: PROJECTION_IDENTITY.owner.issuer,
  sessionId: PROJECTION_IDENTITY.sessionId,
  userId: PROJECTION_IDENTITY.owner.userId,
  organization: { id: PROJECTION_IDENTITY.owner.organizationId },
  permissions: ["training.read", "evaluation.read"],
};
function records() {
  return {
    certificates: [
      readCertification({ ...trainingCertificate(), issuer_reference: "never-cache" }),
    ],
    evaluations: [readEvaluation(trainingEvaluation())],
    hasMoreCertificates: false,
    hasMoreEvaluations: true,
    fetchedAt: PROJECTION_NOW.toISOString(),
  };
}
async function prepare(db: SqlExecutor) {
  const store = new DayStore(db);
  const bundle = new DayBundleService({
    store,
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: () =>
      Promise.resolve({
        kind: "bundle",
        body: { ...projectionBundle(), eligibility: [trainingEligibility()] },
      }),
  });
  await db.runAtomically([setStatement("session_profile", JSON.stringify(PROFILE))]);
  await bundle.refresh();
  return { store, bundle };
}
function action() {
  return {
    identity: PROJECTION_IDENTITY,
    action: "ovitrap.check",
    centerId: CONTRACT_IDS.center,
    quadrantId: CONTRACT_IDS.quadrant,
    now: PROJECTION_NOW,
  };
}
async function readActionQualification(db: SqlExecutor, input = action()) {
  const source = await readTrainingSource(db, input.identity);
  return { state: qualificationForAction(source.eligibility, input) };
}
void test("P30 offline scoped cache preserves feedback/void provenance but excludes raw private material", async () => {
  const { db } = await createStores();
  await prepare(db);
  const source = await readTrainingSource(db, PROJECTION_IDENTITY);
  await saveTrainingRecords(db, source, records());
  const cached = await readTrainingSource(db, PROJECTION_IDENTITY);
  assert.equal(cached.eligibility.length, 1);
  const [feedback] = cached.records?.evaluations ?? [];
  assert.ok(feedback?.current);
  assert.ok(feedback.void);
  assert.equal(feedback.current.predecessor_id, CONTRACT_IDS.actor);
  assert.equal(feedback.void.reason, "Original observation corrected");
  assert.equal(feedback.current.created_by, CONTRACT_IDS.actor);
  const serialized = JSON.stringify(
    await db.query("SELECT value FROM kv WHERE key='training_records'"),
  );
  for (const key of ["section_scores", "critical_responses", "issuer_reference"])
    assert.equal(serialized.includes(key), false);
  await db.runAtomically([
    setStatement("session_profile", JSON.stringify({ ...PROFILE, permissions: [] })),
  ]);
  const denied = await readTrainingSource(db, PROJECTION_IDENTITY);
  assert.ok(denied.records);
  assert.deepEqual(denied.records.certificates, []);
  assert.deepEqual(denied.records.evaluations, []);
  assert.equal(denied.canReadEvaluations, false);
});
void test("P30 malformed eligibility invalidates once and old deltas cannot restore expired authority", async () => {
  const { db } = await createStores();
  const { bundle } = await prepare(db);
  const row = trainingEligibility();
  const change = {
    sequence: 8,
    action: "upsert",
    resource_type: "training_eligibility",
    resource_id: row.id,
    resource_version: "new-semantic",
    data: { ...row, training_eligible: "malformed" },
  };
  await bundle.applyProjectionChanges(projectionChanges({ eligibility: [change] }));
  await assert.rejects(readTrainingSource(db, PROJECTION_IDENTITY));
  await bundle.applyProjectionChanges(
    projectionChanges({ eligibility: [{ ...change, sequence: 7, data: row }] }),
  );
  await assert.rejects(readTrainingSource(db, PROJECTION_IDENTITY));
  await bundle.applyProjectionChanges(
    projectionChanges({ eligibility: [{ ...change, sequence: 9, data: row }] }),
  );
  await assert.rejects(readTrainingSource(db, PROJECTION_IDENTITY));
  await bundle.refresh(true);
  assert.equal((await readActionQualification(db, action())).state, "eligible");
  assert.equal(
    (await readActionQualification(db, { ...action(), now: new Date(row.valid_until ?? "") }))
      .state,
    "expired",
  );
  assert.equal(
    (await readActionQualification(db, { ...action(), centerId: CONTRACT_IDS.otherCenter })).state,
    "unavailable",
  );
});
void test("P30 original publication guard rejects scope ABA and revoke keeps the authored outbox", async () => {
  const { db, outbox } = await createStores();
  const { bundle, store } = await prepare(db);
  const original = await readTrainingSource(db, PROJECTION_IDENTITY);
  const event = makeEnvelope();
  await outbox.enqueue(event);
  await store.markCleanupPending();
  await assert.rejects(readTrainingSource(db, PROJECTION_IDENTITY));
  await bundle.clearSessionData();
  await bundle.refresh();
  await assert.rejects(saveTrainingRecords(db, original, records()));
  const replacement = { ...PROJECTION_IDENTITY, sessionId: "replacement-session" };
  await assert.rejects(readTrainingSource(db, replacement));
  assert.equal((await db.query("SELECT id FROM outbox_event"))[0]?.id, event.id);
  await store.revoke();
  assert.equal(
    (
      await db.query(
        "SELECT 1 FROM kv WHERE key='training_records' OR key GLOB 'training_eligibility:*'",
      )
    ).length,
    0,
  );
  assert.equal((await db.query("SELECT id FROM outbox_event"))[0]?.id, event.id);
});
void test("P30 cold database reopen retains summaries and original pending UUID; failed storage never overwrites cache", async () => {
  const path = join(import.meta.dirname, ".training-restart.sqlite");
  assert.equal(existsSync(path), false);
  let opened = await openTestDatabase(path);
  try {
    await prepare(opened.executor);
    const source = await readTrainingSource(opened.executor, PROJECTION_IDENTITY);
    await saveTrainingRecords(opened.executor, source, records());
    const event = makeEnvelope();
    await new OutboxRepository(opened.executor, () => PROJECTION_NOW).enqueue(event);
    const failing = {
      ...opened.executor,
      runAtomically: () => Promise.reject(new Error("Storage full")),
    };
    await assert.rejects(
      saveTrainingRecords(failing, source, { ...records(), evaluations: [] }),
      /Storage full/,
    );
    opened.close();
    opened = await openTestDatabase(path);
    const restored = await readTrainingSource(opened.executor, PROJECTION_IDENTITY);
    assert.equal(restored.records?.evaluations.length, 1);
    assert.equal((await opened.executor.query("SELECT id FROM outbox_event"))[0]?.id, event.id);
    assert.equal(
      (await opened.executor.query("SELECT local_status FROM outbox_event"))[0]?.local_status,
      "pending",
    );
  } finally {
    opened.close();
    unlinkSync(path);
  }
});
void test("P30 late REST denial cannot erase same-session successor bootstrap or its private cache", async () => {
  const { db } = await createStores();
  const { bundle } = await prepare(db);
  const original = await readTrainingSource(db, PROJECTION_IDENTITY);
  let deny!: () => void;
  const denied = new Promise<void>((resolve) => {
    deny = resolve;
  });
  const cleanup = denied.then(() => clearTrainingProjectionForSource(db, original));
  await bundle.refresh(true);
  const successor = await readTrainingSource(db, PROJECTION_IDENTITY);
  await saveTrainingRecords(db, successor, records());
  deny();
  await cleanup;
  assert.deepEqual((await readTrainingSource(db, PROJECTION_IDENTITY)).records, records());
  await clearTrainingProjectionForSource(db, successor);
  await assert.rejects(readTrainingSource(db, PROJECTION_IDENTITY));
});
