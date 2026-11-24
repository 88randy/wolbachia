import assert from "node:assert/strict";
import { test } from "node:test";
import { currentEventId, harness, publishSnapshots } from "./support/m-08-harness.ts";
import { ASSIGNMENT, CATALOG, POINT, RULES } from "./support/m-08-fixtures.ts";
import { CURRENT_CAPTURE_CONTEXT } from "../src/features/ovitrap-lifecycle/context-sql.ts";
import { revokeCaptureScope } from "../src/features/ovitrap-lifecycle/current-scope.ts";
import { OvitrapStore } from "../src/features/ovitrap-check/store.ts";
import type { SqlExecutor, SqlStatement } from "../src/db/sql.ts";

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

/** Holds the publication transaction at a barrier so another writer can land first. */
function gatedExecutor(db: SqlExecutor) {
  let reached = (): void => undefined;
  const arrived = new Promise<void>((resolve) => {
    reached = resolve;
  });
  let open = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const executor: SqlExecutor = {
    query: (sql, params) => db.query(sql, params),
    runAtomically: async (statements: readonly SqlStatement[]) => {
      reached();
      await gate;
      return db.runAtomically(statements);
    },
  };
  return { executor, arrived, open };
}

async function contextRevision(db: SqlExecutor): Promise<unknown> {
  const [row] = await db.query(
    "SELECT json_extract(value,'$.authorityRevision') AS revision FROM kv WHERE key='lifecycle_capture_context'",
  );
  return row?.revision;
}

void test("a scope revoke that lands before the publication commits keeps the context unavailable", async () => {
  const h = await harness();
  const gated = gatedExecutor(h.db);
  const store = new OvitrapStore(gated.executor);
  const publishing = store.publishSnapshots(
    { catalog: CATALOG, rules: RULES, assignment: ASSIGNMENT },
    await store.assignmentAuthority(),
  );
  await gated.arrived;
  await h.db.runAtomically([revokeCaptureScope()]);
  gated.open();
  await assert.rejects(publishing, /authority/);
  assert.equal((await h.db.query(CURRENT_CAPTURE_CONTEXT)).length, 0);
  assert.equal((await h.store.snapshots()).assignment, null);
});

void test("a newer bootstrap context that lands before the publication commits is not overwritten", async () => {
  const h = await harness();
  const gated = gatedExecutor(h.db);
  const store = new OvitrapStore(gated.executor);
  const publishing = store.publishSnapshots(
    { catalog: CATALOG, rules: RULES, assignment: ASSIGNMENT },
    await store.assignmentAuthority(),
  );
  await gated.arrived;
  await publishSnapshots(h.store, { catalog: CATALOG, rules: RULES, assignment: ASSIGNMENT }, h.db);
  const newer = await contextRevision(h.db);
  gated.open();
  await assert.rejects(publishing, /authority/);
  assert.equal(await contextRevision(h.db), newer);
  assert.equal((await h.db.query(CURRENT_CAPTURE_CONTEXT)).length, 1);
});
