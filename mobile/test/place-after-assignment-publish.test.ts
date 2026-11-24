import assert from "node:assert/strict";
import { test } from "node:test";
import { currentEventId, harness, publishSnapshots } from "./support/m-08-harness.ts";
import { ASSIGNMENT, CATALOG, POINT, RULES } from "./support/m-08-fixtures.ts";
import { CURRENT_CAPTURE_CONTEXT } from "../src/features/ovitrap-lifecycle/context-sql.ts";

/**
 * Device bug 2026-11-24: bootstrap published the capture context, then opening Ovitrampas
 * republished the route assignment (syncAssignment). That bumped the authority revision, the
 * context no longer matched it and the save trigger refused a point the picker offered.
 */
void test("a placement saves after the screen republishes the route assignment over a ready context", async () => {
  const h = await harness();
  await publishSnapshots(h.store, { catalog: CATALOG, rules: RULES, assignment: ASSIGNMENT });
  assert.equal((await h.db.query(CURRENT_CAPTURE_CONTEXT)).length, 1);
  await h.service.startPlace(await currentEventId(h.store));
  await h.service.update(
    {
      point: POINT,
      prepared: ["clean", "water", "liner", "shade", "height", "containers", "safe", "marked"],
    },
    await currentEventId(h.store),
  );
  await h.service.captureEvidence(await currentEventId(h.store));
  const placed = await h.service.save(await currentEventId(h.store));
  assert.equal(placed.event?.envelope.type, "ovitrap.place");
});

void test("republishing never revives a context that was already stale", async () => {
  const h = await harness();
  await h.db.runAtomically([
    {
      sql: "UPDATE kv SET value=json_set(value,'$.authorityRevision',-1) WHERE key='lifecycle_capture_context'",
    },
  ]);
  await publishSnapshots(h.store, { catalog: CATALOG, rules: RULES, assignment: ASSIGNMENT });
  assert.equal((await h.db.query(CURRENT_CAPTURE_CONTEXT)).length, 0);
});
