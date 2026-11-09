import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { DayBundleService } from "../src/features/day/bundle-service.ts";
import type { BundleResult } from "../src/features/day/bundle-service.ts";
import { DayStore } from "../src/features/day/store.ts";
import { ShiftCloseService } from "../src/features/shift-close/service.ts";
import { KvStore } from "../src/db/kv-store.ts";
import { OutboxRepository } from "../src/outbox/outbox-repository.ts";
import { ownerKey } from "../src/attachments/types.ts";
import { openTestDatabase } from "./support/sqlite-executor.ts";
import { makeEnvelope } from "./support/factories.ts";
import { CONTRACT_IDS } from "./support/lifecycle-contract-fixtures.ts";
import {
  projectionBundle,
  projectionChanges,
  PROJECTION_IDENTITY,
  PROJECTION_NOW,
} from "./support/lifecycle-projection-fixtures.ts";

const SHIFT = CONTRACT_IDS.history;
const RECEIPT = "10000000-0000-4000-8000-000000000001";
const CLOSE = "10000000-0000-4000-8000-000000000002";
const SUPPLY = {
  id: CONTRACT_IDS.source,
  shift_id: SHIFT,
  date: "2026-11-06",
  origin_id: CONTRACT_IDS.center,
  reconciliation: { revision: 1, frame: null },
  receipts: [
    {
      id: RECEIPT,
      event_id: RECEIPT,
      source_event_id: RECEIPT,
      release_id: RECEIPT,
      signature_upload_id: RECEIPT,
      voided: false,
      lines: [{ id: RECEIPT, release_line_id: RECEIPT, quantity: "10" }],
    },
  ],
};

void test("an upgraded supply consumer requires a complete bootstrap across failure and reopen without losing its closing draft", async () => {
  const root = realpathSync(tmpdir());
  const directory = mkdtempSync(join(root, "wolbachia-143-bootstrap-"));
  const path = join(directory, "phone.sqlite");
  let phone = await openTestDatabase(path);
  const previousBundle = projectionBundle();
  Reflect.deleteProperty(previousBundle, "supplies");
  let response: BundleResult | Error = { kind: "bundle", body: previousBundle };
  let uuidSequence = 0;
  const etags: (string | null)[] = [];
  const store = () => new DayStore(phone.executor);
  const bundle = () =>
    new DayBundleService({
      store: store(),
      now: () => PROJECTION_NOW,
      getCaptureIdentity: () => PROJECTION_IDENTITY,
      transport: (etag) => {
        etags.push(etag);
        return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
      },
    });
  const closing = () =>
    new ShiftCloseService({
      db: phone.executor,
      now: () => PROJECTION_NOW,
      uuid: () =>
        ++uuidSequence === 1
          ? CLOSE
          : `20000000-0000-4000-8000-${String(uuidSequence).padStart(12, "0")}`,
      identity: () => ownerKey(PROJECTION_IDENTITY.owner),
      pending: () => Promise.resolve([]),
      serialize: (write) => write(),
      notify: () => undefined,
    });
  try {
    // The previous consumer retained a valid cursor/context but did not materialize supplies.
    await bundle().refresh();
    await new OutboxRepository(phone.executor, () => PROJECTION_NOW).enqueue(
      makeEnvelope({
        type: "shift.open",
        shift_id: SHIFT,
        device_time: PROJECTION_NOW.toISOString(),
      }),
    );
    await closing().start();
    await closing().update({ odometer: "110", note: "Retained closing input" });
    const originalDraft = (await closing().read()).draft;
    assert.equal(
      await store().needsBootstrap(false),
      false,
      "legacy day-only callers remain compatible",
    );
    response = { kind: "unchanged" };
    await assert.rejects(bundle().refresh(), /requires a body/);
    response = new Error("offline");
    await assert.rejects(bundle().refresh(), /offline/);
    response = {
      kind: "bundle",
      body: { ...projectionBundle(), supplies: [{ ...SUPPLY, receipts: null }] },
    };
    await assert.rejects(bundle().refresh(), /supply collection/);
    await bundle().applyProjectionChanges(projectionChanges({ supplies: [] }));
    assert.equal(
      await store().needsBootstrap(),
      true,
      "delta hydration cannot acknowledge a full supply snapshot",
    );
    response = {
      kind: "bundle",
      body: { ...projectionBundle(), cursor: "supplies-recovered", supplies: [SUPPLY] },
    };
    await phone.executor.query(
      "CREATE TRIGGER fail_supply_cursor BEFORE INSERT ON kv WHEN NEW.key='sync_cursor' BEGIN SELECT RAISE(ABORT,'write failed'); END",
    );
    await assert.rejects(bundle().refresh(), /write failed/);
    await phone.executor.query("DROP TRIGGER fail_supply_cursor");
    assert.equal(await new KvStore(phone.executor).get("sync_cursor"), "opaque-signed-cursor");
    assert.equal(await store().needsBootstrap(), true);
    assert.deepEqual((await closing().read()).draft, originalDraft);
    phone.close();
    phone = await openTestDatabase(path);
    assert.equal(await store().needsBootstrap(), true);
    await bundle().refresh();
    assert.equal(await store().needsBootstrap(), false);
    assert.equal(await new KvStore(phone.executor).get("sync_cursor"), "supplies-recovered");
    const restored = await closing().refreshSupplies();
    assert.ok(restored.draft);
    assert.equal(restored.draft.closeEventId, CLOSE);
    assert.notEqual(restored.draft.supplies[0]?.eventId, CLOSE);
    assert.equal(restored.draft.note, "Retained closing input");
    assert.equal(restored.draft.supplies[0]?.source.receipts[0]?.source_event_id, RECEIPT);
    response = { kind: "unchanged" };
    await bundle().refresh();
    assert.deepEqual(etags, [null, null, null, null, null, null, "opaque-bundle"]);
    await store().revoke();
    assert.equal(await store().needsBootstrap(), true);
    response = { kind: "bundle", body: { ...projectionBundle(), supplies: [] } };
    await bundle().refresh();
    assert.equal(
      await store().needsBootstrap(),
      false,
      "an authoritative empty supply snapshot is ready",
    );
    assert.equal((await closing().read()).draft?.note, "Retained closing input");
  } finally {
    phone.close();
    assert.equal(dirname(realpathSync(directory)), root);
    rmSync(directory, { recursive: true });
  }
});
