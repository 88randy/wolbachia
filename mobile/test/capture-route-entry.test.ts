import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DayStore } from "../src/features/day/store.ts";
import { DayBundleService } from "../src/features/day/bundle-service.ts";
import { createDayAssignments } from "../src/features/ovitrap-check/day-assignment.ts";
import { publishAssignment } from "../src/features/ovitrap-check/publish-assignment.ts";
import { OvitrapStore } from "../src/features/ovitrap-check/store.ts";
import { createStores, FIXED_NOW } from "./support/factories.ts";
import { engineFor, serviceFor } from "./support/m-08-harness.ts";

const ROUTE_POINT_ID = "b37cedd8-d071-4b95-b1e9-962e0b9404fd";

async function phoneWithRealBundle() {
  const body: unknown = JSON.parse(
    readFileSync(new URL("./support/real-courier-bundle.json", import.meta.url), "utf8"),
  );
  const stores = await createStores();
  const bundles = new DayBundleService({
    store: new DayStore(stores.db),
    now: () => FIXED_NOW,
    transport: () => Promise.reject(new Error("offline")),
  });
  await new DayStore(stores.db).replace(body, FIXED_NOW);
  const auth = {
    getSnapshot: () => ({
      profile: { organization: { id: "org", timezone: "America/Merida", epi_week: "iso" } },
    }),
  };
  const store = new OvitrapStore(stores.db);
  const assignments = createDayAssignments({ bundle: bundles, auth } as never);
  const engine = engineFor(stores);
  const withPublish = () =>
    serviceFor(
      { store, engine },
      { publishAssignment: () => publishAssignment(assignments, store) },
    );
  return { store, engine, withPublish };
}

void test("route entry: a draft left by an earlier open, with no assignment, takes the points of the route", async () => {
  const { store, engine, withPublish } = await phoneWithRealBundle();
  const old = await serviceFor({ store, engine }, {}).startPlace(null);
  assert.equal(old.draft?.assignment, null);
  assert.equal(old.isScopeBlocked, true);
  const service = withPublish();
  await service.syncAssignment();
  const synced = await service.read();
  const point = synced.draft?.assignment?.points.find((item) => item.id === ROUTE_POINT_ID);
  assert.ok(point);
  const chosen = await service.update({ point }, synced.draft?.eventId ?? null);
  assert.equal(chosen.isScopeBlocked, false);
  assert.equal(chosen.draft?.point?.id, ROUTE_POINT_ID);
});

void test("route entry: starting a capture publishes the assignment first, whatever the entry point", async () => {
  const { store, withPublish } = await phoneWithRealBundle();
  assert.equal((await store.snapshots()).assignment, null);
  const started = await withPublish().startPlace(null);
  assert.ok(started.draft?.assignment?.points.some((item) => item.id === ROUTE_POINT_ID));
  assert.equal(started.isScopeBlocked, false);
});
