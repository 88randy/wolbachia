import assert from "node:assert/strict";
import { test } from "node:test";
import { DayStore } from "../src/features/day/store.ts";
import { DayBundleService } from "../src/features/day/bundle-service.ts";
import { createDayAssignments } from "../src/features/ovitrap-check/day-assignment.ts";
import { publishAssignment } from "../src/features/ovitrap-check/publish-assignment.ts";
import { OvitrapStore } from "../src/features/ovitrap-check/store.ts";
import { revokeCaptureScope } from "../src/features/ovitrap-lifecycle/current-scope.ts";
import { setStatement } from "../src/db/kv-store.ts";
import { createStores, FIXED_NOW } from "./support/factories.ts";
import { readFileSync } from "node:fs";
import { engineFor, serviceFor } from "./support/m-08-harness.ts";
import type { Assignment } from "../src/features/ovitrap-check/types.ts";

const ROUTE_POINT_ID = "b37cedd8-d071-4b95-b1e9-962e0b9404fd";
const TASK_ID = "11111111-1111-4111-8111-111111111111";
const POINT_ID = "22222222-2222-4222-8222-222222222222";
const QUADRANT_ID = "33333333-3333-4333-8333-333333333333";
const BLOCK_ID = "44444444-4444-4444-8444-444444444444";
const COURIER_ID = "55555555-5555-4555-8555-555555555555";

/** Shaped like the backend courier bundle: tasks carry no coordinates; points come separately. */
const bundle = {
  bundle_version: "bundle-1",
  schema_version: "schema-1",
  scope_revision: "scope-1",
  cursor: "cursor-1",
  next_change_at: null,
  map_manifest_ready: false,
  assignments: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      kind: "quadrant_assignment",
      quadrant_id: QUADRANT_ID,
      courier: COURIER_ID,
      revision: 1,
    },
    {
      id: TASK_ID,
      kind: "task",
      code: "Q-MER-01-B1-P1:place:2026-11-10",
      point: POINT_ID,
      quadrant_id: QUADRANT_ID,
      courier: COURIER_ID,
      revision: 1,
      action: "place",
      date: "2026-11-10",
      category: "medium",
      source: null,
      protocol: null,
      target: 1,
      is_completed: false,
    },
  ],
  map_manifests: [],
  sampling_points: [
    {
      id: POINT_ID,
      code: "Q-MER-01-B1-P1",
      block_id: BLOCK_ID,
      quadrant_id: QUADRANT_ID,
      location: [-89.62, 20.97],
      is_retired: false,
      version: 1,
    },
  ],
};

async function fixture() {
  const stores = await createStores();
  const day = new DayStore(stores.db);
  const bundles = new DayBundleService({
    store: day,
    now: () => FIXED_NOW,
    transport: () => Promise.reject(new Error("offline")),
  });
  await day.replace(bundle, FIXED_NOW);
  const auth = {
    getSnapshot: () => ({
      profile: { organization: { id: "org", timezone: "America/Merida", epi_week: "iso" } },
    }),
  };
  const real = createDayAssignments({ bundle: bundles, auth } as never);
  const store = new OvitrapStore(stores.db);
  const build = (assignments: { read(): Promise<Assignment | null> }) => ({
    refresh: () => publishAssignment(assignments, store),
  });
  return { stores, store, real, build };
}

async function refreshOffline(service: { refresh(): Promise<void> }) {
  await service.refresh();
}

void test("capture assignment: publishing builds the assignment from the route's own bundle with no network", async () => {
  const { store, real, build } = await fixture();
  assert.equal((await store.snapshots()).assignment, null);
  await refreshOffline(build(real));
  const { assignment } = await store.snapshots();
  assert.ok(assignment);
  assert.deepEqual(
    assignment.points.map((point) => point.id),
    [POINT_ID],
  );
  assert.deepEqual(assignment.placePointIds, [POINT_ID]);
});

void test("capture assignment: a bundle write between the read and the publish is retried, not swallowed", async () => {
  const { stores, store, real, build } = await fixture();
  let isBumped = false;
  const racing = {
    read: async () => {
      const assignment = await real.read();
      if (!isBumped) {
        isBumped = true;
        await stores.db.runAtomically([revokeCaptureScope()]);
      }
      return assignment;
    },
  };
  await refreshOffline(build(racing));
  assert.equal((await store.snapshots()).assignment?.points.length, 1);
});

void test("capture assignment: a stuck cleanup flag is reported with a reason code", async () => {
  const { stores, real, build } = await fixture();
  await stores.db.runAtomically([setStatement("day_cleanup_pending", "true")]);
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (message: string) => warnings.push(message);
  try {
    await assert.rejects(build(real).refresh(), /authority/);
  } finally {
    console.warn = original;
  }
  assert.ok(warnings.some((line) => line.includes("reason=no_bundle_meta")));
  assert.ok(warnings.some((line) => line.includes("reason=cleanup_pending")));
});

void test("capture assignment: the route path with the real courier bundle lists the point and is not blocked", async () => {
  const body: unknown = JSON.parse(
    readFileSync(new URL("./support/real-courier-bundle.json", import.meta.url), "utf8"),
  );
  const stores = await createStores();
  const day = new DayStore(stores.db);
  const bundles = new DayBundleService({
    store: day,
    now: () => FIXED_NOW,
    transport: () => Promise.reject(new Error("offline")),
  });
  await day.replace(body, FIXED_NOW);
  const auth = {
    getSnapshot: () => ({
      profile: { organization: { id: "org", timezone: "America/Merida", epi_week: "iso" } },
    }),
  };
  const store = new OvitrapStore(stores.db);
  await publishAssignment(createDayAssignments({ bundle: bundles, auth } as never), store);
  const service = serviceFor({ store, engine: engineFor(stores) }, {});
  const started = await service.startPlace(null);
  const point = started.draft?.assignment?.points.find((item) => item.id === ROUTE_POINT_ID);
  assert.ok(point, "the point of the route is in the list");
  assert.ok((started.draft?.assignment?.placePointIds ?? []).includes(ROUTE_POINT_ID));
  const chosen = await service.update({ point }, started.draft?.eventId ?? null);
  assert.equal(chosen.isScopeBlocked, false);
  assert.equal(chosen.assignmentCode, null);
  assert.equal(chosen.draft?.point?.id, ROUTE_POINT_ID);
});
