import assert from "node:assert/strict";
import { test } from "node:test";
import { setStatement } from "../src/db/kv-store.ts";
import { DayStore } from "../src/features/day/store.ts";
import {
  clearReleaseProjection,
  invalidateReleaseProjection,
  needsReleaseBootstrap,
  readReleaseProjection,
  releaseBundleStatements,
  releaseChangeStatements,
} from "../src/features/releases/projections.ts";
import { readReleaseTask } from "../src/features/releases/projection-contract.ts";
import { createStores } from "./support/factories.ts";
import { CONTRACT_IDS } from "./support/lifecycle-contract-fixtures.ts";
import {
  PROJECTION_IDENTITY,
  PROJECTION_NOW,
  projectionBundle,
  projectionChanges,
} from "./support/lifecycle-projection-fixtures.ts";

const id = (suffix: number) => `10000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
function permit() {
  return {
    id: id(1),
    code: "PERMIT-139",
    version: "permit-v1",
    permit_version_id: id(2),
    permit_type_id: id(3),
    revision: 1,
    center_id: CONTRACT_IDS.center,
    quadrant_id: CONTRACT_IDS.quadrant,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-100, 18],
          [-98, 18],
          [-98, 20],
          [-100, 20],
          [-100, 18],
        ],
      ],
    },
    valid_from: "2026-01-01T00:00:00Z",
    valid_to: "2027-01-01T00:00:00Z",
    requirements: { max_gps_accuracy_m: 12 },
    blocked_by: [] as string[],
    capture: null,
  };
}
function eligibility() {
  return {
    id: id(4),
    version: "training-v1",
    organization_id: PROJECTION_IDENTITY.owner.organizationId,
    subject_id: PROJECTION_IDENTITY.owner.userId,
    action: "release.record",
    center_id: CONTRACT_IDS.center,
    quadrant_id: CONTRACT_IDS.quadrant,
    training_eligible: true,
    requirement_version_id: id(5),
    training_version_ids: [id(6)],
    certification_ids: [id(7)],
    revocation_ids: [],
    blockers: [],
    assessment_receipt: id(8),
    valid_from: "2026-01-01T00:00:00Z",
    valid_until: "2027-01-01T00:00:00Z",
    next_change_at: null,
  };
}
function task() {
  return {
    id: id(9),
    kind: "task",
    code: "RELEASE-139",
    point: CONTRACT_IDS.point,
    quadrant_id: CONTRACT_IDS.quadrant,
    courier: PROJECTION_IDENTITY.owner.userId,
    revision: 1,
    action: "release",
    date: "2026-11-06",
    category: null,
    source: null,
    protocol: null,
    target: 1,
    is_completed: false,
  };
}
function body() {
  return {
    ...projectionBundle(),
    permits: [permit()],
    eligibility: [eligibility()],
    assignments: [task()],
  };
}
function profile() {
  return {
    issuer: PROJECTION_IDENTITY.owner.issuer,
    sessionId: PROJECTION_IDENTITY.sessionId,
    userId: PROJECTION_IDENTITY.owner.userId,
    organization: { id: PROJECTION_IDENTITY.owner.organizationId },
    permissions: ["field_event.sync"],
  };
}
async function setup() {
  const { db } = await createStores();
  const store = new DayStore(db);
  const initial = await store.captureTransport(PROJECTION_IDENTITY, () => true);
  await store.replace(projectionBundle(), PROJECTION_NOW, initial);
  const handle = await store.captureTransport(PROJECTION_IDENTITY, () => true);
  assert.ok(handle);
  await db.runAtomically([setStatement("session_profile", JSON.stringify(profile()))]);
  return { db, store, handle };
}
function change(kind: string, record: { id: string }, sequence: number) {
  return {
    sequence,
    action: "upsert",
    resource_type: kind,
    resource_id: record.id,
    resource_version: `revision-${String(sequence)}`,
    data: record,
  };
}

void test("release projections expose only original own paired permit/training/task facts without manufacturing missing release authority", async () => {
  const { db, handle } = await setup();
  const bundle = body();
  bundle.permits.push({ ...permit(), id: id(20), center_id: CONTRACT_IDS.otherCenter });
  bundle.eligibility.push({ ...eligibility(), id: id(21), subject_id: id(22) });
  bundle.eligibility.push({ ...eligibility(), id: id(23), organization_id: id(24) });
  bundle.eligibility.push({ ...eligibility(), id: id(25), action: "ovitrap.check" });
  bundle.assignments.push({ ...task(), id: id(26), courier: id(27) });
  bundle.assignments.push({ ...task(), id: id(28), quadrant_id: CONTRACT_IDS.otherQuadrant });
  await db.runAtomically(releaseBundleStatements(bundle, handle));
  const source = await readReleaseProjection(db, handle);
  assert.deepEqual(source.permits, [permit()]);
  assert.deepEqual(source.eligibility, [eligibility()]);
  assert.deepEqual(source.tasks, [task()]);
  assert.equal((await db.query(source.guard.sql, source.guard.params)).length, 1);
  assert.equal("devices" in source, false);
  assert.equal("permit_version_id" in (source.tasks[0] ?? {}), false);
  assert.throws(() => readReleaseTask({ ...task(), is_completed: undefined }));
  assert.throws(() =>
    releaseBundleStatements({ ...body(), permits: [permit(), permit()] }, handle),
  );
});

void test("release projection requires full explicit bootstrap and original authenticated owner; deltas never hydrate it", async () => {
  const { db, handle } = await setup();
  assert.equal(await needsReleaseBootstrap(db), true);
  await db.runAtomically(
    releaseChangeStatements(
      projectionChanges({ permits: [change("permit", permit(), 1)] }),
      handle,
    ),
  );
  assert.equal(await needsReleaseBootstrap(db), true);
  await assert.rejects(readReleaseProjection(db, handle), /unavailable/);
  for (const missing of ["permits", "eligibility", "assignments"]) {
    const incomplete: Record<string, unknown> = body();
    Reflect.deleteProperty(incomplete, missing);
    await db.runAtomically(releaseBundleStatements(incomplete, handle));
    assert.equal(await needsReleaseBootstrap(db), true);
  }
  await db.runAtomically(
    releaseBundleStatements(body(), { ...handle, owner: { ...handle.owner, userId: id(30) } }),
  );
  assert.equal(await needsReleaseBootstrap(db), true);
  await db.runAtomically(releaseBundleStatements(body(), handle));
  assert.equal(await needsReleaseBootstrap(db), false);
  await db.runAtomically([invalidateReleaseProjection]);
  await db.runAtomically(releaseChangeStatements(projectionChanges(), handle));
  assert.equal(await needsReleaseBootstrap(db), true);
});

void test("new suspension or malformed newer facts invalidate original raw CAS and cannot be restored by an older delta", async () => {
  const { db, handle } = await setup();
  await db.runAtomically(releaseBundleStatements(body(), handle));
  const original = await readReleaseProjection(db, handle);
  const suspended = { ...permit(), version: "suspended", blocked_by: ["permit_suspended"] };
  const suspension = change("permit", suspended, 10);
  await db.runAtomically(
    releaseChangeStatements(projectionChanges({ permits: [suspension] }), handle),
  );
  assert.equal((await db.query(original.guard.sql, original.guard.params)).length, 0);
  assert.deepEqual((await readReleaseProjection(db, handle)).permits[0]?.blocked_by, [
    "permit_suspended",
  ]);
  assert.deepEqual(original.permits[0]?.blocked_by, []);
  await db.runAtomically(
    releaseChangeStatements(
      projectionChanges({
        permits: [{ ...suspension, sequence: 11, data: { ...suspended, valid_to: "invalid" } }],
      }),
      handle,
    ),
  );
  assert.deepEqual((await readReleaseProjection(db, handle)).permits, []);
  await db.runAtomically(
    releaseChangeStatements(projectionChanges({ permits: [suspension] }), handle),
  );
  assert.deepEqual((await readReleaseProjection(db, handle)).permits, []);
  assert.throws(() =>
    releaseChangeStatements(
      projectionChanges({ permits: [{ ...suspension, resource_id: id(31) }] }),
      handle,
    ),
  );
  await db.runAtomically(
    releaseChangeStatements(
      projectionChanges({
        assignments: [{ ...change("task", task(), 12), action: "remove", data: {} }],
      }),
      handle,
    ),
  );
  assert.deepEqual((await readReleaseProjection(db, handle)).tasks, []);
});

void test("release projection read and raw write guard close on profile/session/authority cleanup changes", async () => {
  const { db, store, handle } = await setup();
  await db.runAtomically(releaseBundleStatements(body(), handle));
  const source = await readReleaseProjection(db, handle);
  for (const replacement of [
    { ...profile(), permissions: [] },
    { ...profile(), sessionId: "replacement-session" },
    { ...profile(), organization: { id: id(40) } },
  ]) {
    await db.runAtomically([setStatement("session_profile", JSON.stringify(replacement))]);
    await assert.rejects(readReleaseProjection(db, handle), /unavailable/);
    assert.equal((await db.query(source.guard.sql, source.guard.params)).length, 0);
  }
  await db.runAtomically([setStatement("session_profile", JSON.stringify(profile()))]);
  await assert.rejects(
    readReleaseProjection(db, { ...handle, isCurrent: () => false }),
    /unavailable/,
  );
  await store.markCleanupPending();
  await assert.rejects(readReleaseProjection(db, handle), /unavailable/);
  assert.equal((await db.query(source.guard.sql, source.guard.params)).length, 0);
  await db.runAtomically(clearReleaseProjection);
  assert.equal(await needsReleaseBootstrap(db), true);
});

void test("ordinary assignment deltas keep the existing day consumer usable without creating release authority", async () => {
  const { db, store, handle } = await setup();
  await db.runAtomically(releaseBundleStatements(body(), handle));
  const ordinary = ["assignments", "assignment", "task"].map((resourceType, index) => {
    const record = { ...task(), id: `task-${String(index + 1)}`, action: "check", revision: 2 };
    return change(resourceType, record, index + 20);
  });
  await store.applyChanges(projectionChanges({ assignments: ordinary }), handle);
  const current = await store.captureTransport(PROJECTION_IDENTITY, () => true);
  assert.ok(current);
  assert.deepEqual((await readReleaseProjection(db, current)).tasks, [task()]);
  assert.deepEqual((await store.read()).tasks.map(({ task: row }) => row.id).sort(), [
    "task-1",
    "task-2",
    "task-3",
  ]);
});

void test("an unrelated change for a real release task invalidates its authority while genuine release envelopes remain strict", async () => {
  const { db, handle } = await setup();
  await db.runAtomically(releaseBundleStatements(body(), handle));
  const record = { ...task(), action: "check" };
  const unrelated = change("assignment", record, 30);
  await db.runAtomically(
    releaseChangeStatements(projectionChanges({ assignments: [unrelated] }), handle),
  );
  assert.deepEqual((await readReleaseProjection(db, handle)).tasks, []);
  await db.runAtomically(
    releaseChangeStatements(
      projectionChanges({ assignments: [change("task", task(), 29)] }),
      handle,
    ),
  );
  assert.deepEqual(
    (await readReleaseProjection(db, handle)).tasks,
    [],
    "an older release delta cannot restore invalidated authority",
  );
  for (const malformed of [
    change("assignment", task(), 31),
    change("quadrant_assignment", task(), 31),
    { ...change("task", task(), 31), sequence: 0 },
    { ...change("task", task(), 31), resource_id: "task-legacy" },
    { ...change("task", task(), 31), resource_id: id(99) },
    { ...change("task", task(), 31), action: "remove", resource_id: "task-legacy", data: {} },
  ])
    assert.throws(() =>
      releaseChangeStatements(projectionChanges({ assignments: [malformed] }), handle),
    );
});
