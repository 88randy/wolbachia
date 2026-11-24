import assert from "node:assert/strict";
import { test } from "node:test";
import { DayStore } from "../src/features/day/store.ts";
import { DayBundleService } from "../src/features/day/bundle-service.ts";
import { mutateCaptureAuthority } from "../src/features/ovitrap-check/snapshot-authority.ts";
import { invalidateCaptureContext } from "../src/features/ovitrap-lifecycle/context-state.ts";
import { CURRENT_CAPTURE_CONTEXT } from "../src/features/ovitrap-lifecycle/context-sql.ts";
import type { SqlStatement } from "../src/db/sql.ts";
import { currentEventId, harness, serviceFor } from "./support/m-08-harness.ts";
import { ASSIGNMENT, POINT } from "./support/m-08-fixtures.ts";
import { fixtureBundle } from "./support/lifecycle-capture-fixture.ts";
import { PROJECTION_IDENTITY, PROJECTION_NOW } from "./support/lifecycle-projection-fixtures.ts";

/** Field states of 2026-11-24: the pre-fix publication bumped R -> R+1 and left the context at R;
 * a later sync pass then republished it as not ready. Neither ever requested a new bootstrap. */
const STALE_STATES: Record<string, readonly SqlStatement[]> = {
  "context at R, snapshots at R+1": [
    mutateCaptureAuthority({ assignmentSql: "json_extract(kv.value,'$.assignment')" }),
  ],
  "context not ready after a sync pass": [
    mutateCaptureAuthority({ assignmentSql: "json_extract(kv.value,'$.assignment')" }),
    ...invalidateCaptureContext,
  ],
};

for (const [name, statements] of Object.entries(STALE_STATES)) {
  void test(`opening Ovitrampas recovers a stale capture context (${name}) and the placement saves`, async () => {
    const h = await harness();
    await h.db.runAtomically(statements);
    assert.equal((await h.db.query(CURRENT_CAPTURE_CONTEXT)).length, 0);
    const etags: (string | null)[] = [];
    const bundle = new DayBundleService({
      store: new DayStore(h.db),
      now: () => PROJECTION_NOW,
      getCaptureIdentity: () => PROJECTION_IDENTITY,
      transport: (etag) => {
        etags.push(etag);
        return Promise.resolve({ kind: "bundle", body: fixtureBundle(ASSIGNMENT) });
      },
    });
    const service = serviceFor(
      { store: h.store, engine: h.engine },
      { recoverCapture: bundle.recoverCaptureContext },
    );
    await service.refreshInBackground();
    assert.deepEqual(etags, [null], "one full bootstrap body is requested");
    assert.equal((await h.db.query(CURRENT_CAPTURE_CONTEXT)).length, 1);
    await service.refreshInBackground();
    assert.equal(etags.length, 1, "a current context asks for nothing");
    await service.startPlace(await currentEventId(h.store));
    await service.update(
      {
        point: POINT,
        prepared: ["clean", "water", "liner", "shade", "height", "containers", "safe", "marked"],
      },
      await currentEventId(h.store),
    );
    await service.captureEvidence(await currentEventId(h.store));
    const placed = await service.save(await currentEventId(h.store));
    assert.equal(placed.event?.envelope.type, "ovitrap.place");
  });
}

void test("recovery never widens scope: a bundle without capture context keeps saving refused", async () => {
  const h = await harness();
  await h.db.runAtomically(STALE_STATES["context at R, snapshots at R+1"] ?? []);
  const bundle = new DayBundleService({
    store: new DayStore(h.db),
    now: () => PROJECTION_NOW,
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: () => Promise.resolve({ kind: "bundle", body: fixtureBundle(ASSIGNMENT, null) }),
  });
  const service = serviceFor(
    { store: h.store, engine: h.engine },
    { recoverCapture: bundle.recoverCaptureContext },
  );
  await service.refreshInBackground();
  assert.equal((await h.db.query(CURRENT_CAPTURE_CONTEXT)).length, 0);
});
