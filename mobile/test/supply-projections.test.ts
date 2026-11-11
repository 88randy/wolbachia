import assert from "node:assert/strict";
import { test } from "node:test";
import { readSupplyAssignment } from "../src/features/supply-receipt/projection-contract.ts";
import { DayStore } from "../src/features/day/store.ts";
import { DayBundleService } from "../src/features/day/bundle-service.ts";
import { createStores } from "./support/factories.ts";
import {
  PROJECTION_IDENTITY,
  PROJECTION_NOW,
  projectionBundle,
} from "./support/lifecycle-projection-fixtures.ts";
import { projectionChanges } from "./support/lifecycle-projection-fixtures.ts";
import { CONTRACT_IDS } from "./support/lifecycle-contract-fixtures.ts";
import { setStatement } from "../src/db/kv-store.ts";

const id = (suffix: number) => `10000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
function assignment() {
  return {
    id: id(1),
    courier_id: PROJECTION_IDENTITY.owner.userId,
    organization_id: PROJECTION_IDENTITY.owner.organizationId,
    origin_id: id(2),
    center_id: CONTRACT_IDS.center,
    quadrant_id: null,
    date: "2026-01-15",
    shift_id: null,
    revision: 1,
    version_id: id(4),
    planning_proof: {},
    lines: [
      { id: id(5), lot_id: id(6), piece_id: null, unit_version_id: id(7), quantity: "2.000000" },
    ],
    reconciliation: null,
    releases: [
      {
        id: id(8),
        plan_revision: 1,
        manifest_hash: "a".repeat(64),
        warehouse_signed: false,
        lines: [
          { id: id(9), assignment_line_id: id(5), quantity: "2.000000", transit_policy_id: null },
        ],
      },
    ],
    receipts: [],
  };
}

void test("M05 projection contract preserves exact units/releases and refuses ambiguous or malformed custody", () => {
  assert.deepEqual(readSupplyAssignment(assignment()), assignment());
  for (const quantity of ["-1", "1e2", "1.0000001", "100000000000000", "NaN"]) {
    const value = assignment();
    value.lines = value.lines.map((line) => ({ ...line, quantity }));
    assert.throws(() => readSupplyAssignment(value));
  }
  const duplicate = assignment();
  const [first] = duplicate.lines;
  assert.ok(first);
  duplicate.lines.push(first);
  assert.throws(() => readSupplyAssignment(duplicate));
  const broken = assignment();
  broken.releases = broken.releases.map((release) => ({
    ...release,
    lines: release.lines.map((line) => ({ ...line, assignment_line_id: id(20) })),
  }));
  assert.throws(() => readSupplyAssignment(broken));
});

void test("M05 atomic supply projection gates own actions and rejects stale draft CAS after assignment change", async () => {
  const { db } = await createStores();
  const store = new DayStore(db);
  const body = {
    ...projectionBundle(),
    supplies: [
      assignment(),
      { ...assignment(), id: id(30), courier_id: id(31) },
      { ...assignment(), id: id(32), center_id: CONTRACT_IDS.otherCenter },
    ],
  };
  const bundle = new DayBundleService({
    store,
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: () => Promise.resolve({ kind: "bundle", body }),
  });
  const profile = {
    issuer: PROJECTION_IDENTITY.owner.issuer,
    sessionId: PROJECTION_IDENTITY.sessionId,
    userId: PROJECTION_IDENTITY.owner.userId,
    organization: { id: PROJECTION_IDENTITY.owner.organizationId },
    permissions: ["supply_assignment.receive", "field.upload"],
  };
  await db.runAtomically([setStatement("session_profile", JSON.stringify(profile))]);
  await bundle.refresh();
  const original = await bundle.withSupplyAssignments((source) => Promise.resolve(source));
  assert.equal(original.assignments.length, 1);
  assert.equal((await db.query(original.guard.sql, original.guard.params)).length, 1);
  const revised = { ...assignment(), revision: 2, version_id: id(22) };
  const change = {
    sequence: 10,
    action: "upsert",
    resource_type: "supply_assignment",
    resource_id: id(1),
    resource_version: "new-plan",
    data: revised,
  };
  await bundle.applyProjectionChanges(projectionChanges({ supplies: [change] }));
  assert.equal((await db.query(original.guard.sql, original.guard.params)).length, 0);
  assert.equal(original.assignments[0]?.revision, 1, "original draft source stays immutable");
  assert.equal(
    await bundle.withSupplyAssignments((source) =>
      Promise.resolve(source.assignments[0]?.revision),
    ),
    2,
  );
  await bundle.applyProjectionChanges(
    projectionChanges({
      supplies: [{ ...change, sequence: 11, data: { ...revised, lines: "malformed" } }],
    }),
  );
  assert.deepEqual(
    await bundle.withSupplyAssignments((source) => Promise.resolve(source.assignments)),
    [],
  );
  await bundle.applyProjectionChanges(projectionChanges({ supplies: [change] }));
  assert.deepEqual(
    await bundle.withSupplyAssignments((source) => Promise.resolve(source.assignments)),
    [],
    "older delta cannot restore invalidated authority",
  );
  await assert.rejects(
    bundle.applyProjectionChanges(
      projectionChanges({ supplies: [{ ...change, sequence: 12, resource_id: "unknown" }] }),
    ),
  );
  assert.deepEqual(
    await bundle.withSupplyAssignments((source) => Promise.resolve(source.assignments)),
    [],
  );
  await db.runAtomically([
    setStatement("session_profile", JSON.stringify({ ...profile, permissions: ["field.upload"] })),
  ]);
  await assert.rejects(
    bundle.withSupplyAssignments(() => Promise.resolve()),
    /unavailable/,
  );
});

void test("M05 new projection needs a complete bootstrap body; delta and unexpected304 cannot hydrate it", async () => {
  const { db } = await createStores();
  const store = new DayStore(db);
  assert.equal(await store.needsSupplyBootstrap(), true);
  await store.applyChanges({ supplies: [] });
  assert.equal(await store.needsSupplyBootstrap(), true);
  const bundle = new DayBundleService({
    store,
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: () => Promise.resolve({ kind: "unchanged" }),
  });
  await assert.rejects(bundle.refresh(), /requires a body/);
  const handle = await store.captureTransport(PROJECTION_IDENTITY, () => true);
  await store.replace({ ...projectionBundle(), supplies: [] }, PROJECTION_NOW, handle);
  assert.equal(await store.needsSupplyBootstrap(), false);
  await store.revoke();
  assert.equal(await store.needsSupplyBootstrap(), true);
});
