import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createApiClient } from "@wolbachia/api-client";
import { FuelService } from "../src/features/fuel/service.ts";
import type { FuelShift } from "../src/features/fuel/service.ts";
import { FuelStore } from "../src/features/fuel/store.ts";
import type { EvidencePort } from "../src/features/ovitrap-check/types.ts";
import { receiptHarness, receiptId } from "./support/m-05-fixtures.ts";
import { NOW, PNG_BYTES } from "./support/attachment-fixtures.ts";
import { deferred } from "./support/auth-fakes.ts";
import { hasLocalRecords } from "../src/db/owner-data.ts";
import { readText } from "../src/db/sql.ts";
import { setStatement } from "../src/db/kv-store.ts";
import { OutboxWriteError } from "../src/outbox/outbox-repository.ts";
import { runSyncPass } from "../src/sync/sync-pass.ts";
import { createSyncTransport } from "../src/sync/sync-transport.ts";
import type { SyncBatchRequest } from "../src/sync/sync-transport.ts";
import { PROJECTION_IDENTITY, projectionChanges } from "./support/lifecycle-projection-fixtures.ts";
import { REVIEW_HISTORY, historyChange } from "./support/lifecycle-contract-fixtures.ts";
import { answer } from "./support/scripted-transport.ts";

type Journal = Pick<
  Awaited<ReturnType<typeof receiptHarness>>,
  "db" | "attachments" | "bundle" | "engine"
>;
const SHIFT_KEY = "m11-test-shift";
const ORIGINAL_SHIFT = { id: receiptId(50), motorcycleCode: "M-03", odometer: 12000 };

async function readShift(journal: Journal): Promise<FuelShift> {
  const [row] = await journal.db.query("SELECT value FROM kv WHERE key=?", [SHIFT_KEY]);
  assert.ok(row);
  const raw = readText(row, "value");
  return {
    ...(JSON.parse(raw) as Omit<FuelShift, "guard">),
    guard: { sql: "SELECT 1 FROM kv WHERE key=? AND value=?", params: [SHIFT_KEY, raw] },
  };
}

async function harness(t: Parameters<typeof receiptHarness>[0]) {
  const local = await receiptHarness(t);
  await local.db.runAtomically([setStatement(SHIFT_KEY, JSON.stringify(ORIGINAL_SHIFT))]);
  let sequence = 500;
  let camera: EvidencePort["capture"] = () =>
    Promise.resolve({ id: receiptId(sequence++), fileRef: pathToFileURL(local.source).href });
  const compose = (journal: Journal) =>
    new FuelService({
      store: new FuelStore(journal.db),
      attachments: journal.attachments,
      bundle: journal.bundle,
      engine: journal.engine,
      current: journal.attachments.session.deps.current,
      canCapture: () => true,
      shift: () => readShift(journal),
      photo: { capture: (context) => camera(context) },
      uuid: () => receiptId(sequence++),
      now: () => NOW,
    });
  const service = compose(local);
  return {
    ...local,
    service,
    compose,
    camera: (next: EvidencePort["capture"]) => {
      camera = next;
    },
    setShift: (shift: Omit<FuelShift, "guard">) =>
      local.db.runAtomically([setStatement(SHIFT_KEY, JSON.stringify(shift))]),
  };
}
async function filled(h: Awaited<ReturnType<typeof harness>>) {
  await h.service.begin();
  const id = (await h.service.read()).draft?.eventId;
  assert.ok(id);
  await h.service.edit("litres", "4.500", id);
  await h.service.edit("amount", "108.00", id);
  await h.service.edit("odometer", "12180", id);
  await h.service.edit("isFullRefill", true, id);
  return id;
}

void test("M11 a retained prior-shift draft never prevents capture for the current motorcycle", async (t) => {
  for (const shouldSave of [false, true]) {
    const h = await harness(t),
      previous = await filled(h);
    if (shouldSave) await h.service.save(previous);
    await h.setShift({ id: receiptId(70), motorcycleCode: "M-04", odometer: 15000 });
    const retained = await h.service.read();
    assert.equal(retained.ready, false);
    assert.equal(retained.canBegin, true);
    assert.equal(retained.draft?.eventId, previous);
    assert.equal(retained.advisory.kind, "insufficient");
    await h.service.begin();
    const current = await h.service.read();
    assert.equal(current.ready, true);
    assert.ok(current.draft);
    assert.equal(current.draft.motorcycleCode, "M-04");
    assert.equal(current.draft.shiftId, receiptId(70));
    assert.equal(current.drafts.find((row) => row.eventId === previous)?.litres, "4.500");
  }
});

void test("M11 retake persists only a new receipt, retaining raw fields and old bytes through failure, cancel and restart", async (t) => {
  const h = await harness(t),
    id = await filled(h);
  await h.service.photo(id);
  const original = (await h.service.read()).draft;
  assert.ok(original?.receipt);
  h.camera(() => Promise.reject(new Error("Camera denied")));
  await assert.rejects(h.service.photo(id));
  assert.deepEqual((await h.service.read()).draft, original);
  h.camera(() => Promise.resolve(null));
  await h.service.photo(id);
  assert.deepEqual((await h.service.read()).draft, original);
  h.camera(() => Promise.resolve({ id: receiptId(600), fileRef: pathToFileURL(h.source).href }));
  await h.service.photo(id);
  const replacement = (await h.service.read()).draft;
  assert.ok(replacement?.receipt);
  assert.notEqual(replacement.receipt.id, original.receipt.id);
  assert.deepEqual({ ...replacement, receipt: original.receipt }, original);
  assert.deepEqual(await readFile(original.receipt.fileRef), PNG_BYTES);
  const reopened = await h.reopen();
  assert.deepEqual((await h.compose(reopened).read()).draft, replacement);
});

void test("M11 Save rolls back event and current receipt enrollment together and retains both photos after restart", async (t) => {
  const h = await harness(t),
    id = await filled(h);
  await h.service.photo(id);
  const original = (await h.service.read()).draft;
  assert.ok(original?.receipt);
  await h.service.photo(id);
  const replacement = (await h.service.read()).draft;
  assert.ok(replacement?.receipt);
  assert.equal(await hasLocalRecords(h.db), true);
  await h.db.query(
    "CREATE TRIGGER m11_storage_failure BEFORE INSERT ON attachment_event BEGIN SELECT RAISE(ABORT,'Synthetic storage failure'); END",
  );
  await assert.rejects(h.service.save(id), OutboxWriteError);
  assert.equal((await h.service.read()).event, null);
  assert.deepEqual((await h.service.read()).draft, replacement);
  assert.equal((await h.db.query("SELECT id FROM outbox_event")).length, 0);
  assert.equal((await h.db.query("SELECT evidence_id FROM attachment_event")).length, 0);
  await h.db.query("DROP TRIGGER m11_storage_failure");
  await h.service.save(id);
  const saved = await h.service.read();
  assert.equal(saved.event?.status, "pending");
  assert.equal(saved.receiptPending, true);
  await assert.rejects(h.service.edit("amount", "999", id));
  await assert.rejects(h.service.save(id));
  const reopened = await h.reopen();
  const restored = await h.compose(reopened).read();
  assert.deepEqual(restored.draft, saved.draft);
  assert.deepEqual(restored.event?.envelope, saved.event.envelope);
  const bindings = await reopened.db.query("SELECT evidence_id,event_id FROM attachment_event");
  assert.deepEqual(
    bindings.map((row) => [row.evidence_id, row.event_id]),
    [[replacement.receipt.id, id]],
  );
  assert.deepEqual(await readFile(original.receipt.fileRef), PNG_BYTES);
  assert.deepEqual(await readFile(replacement.receipt.fileRef), PNG_BYTES);
});

void test("M11 restart and lost HTTP acknowledgement retry the original fuel UUID and retain later review separately", async (t) => {
  const h = await harness(t),
    id = await filled(h);
  await h.service.save(id);
  const original = await h.service.read();
  assert.ok(original.event);
  const reopened = await h.reopen(),
    service = h.compose(reopened);
  assert.deepEqual((await service.read()).draft, original.draft);
  const requests: SyncBatchRequest[] = [],
    serverIds = new Set<string>();
  const client = createApiClient({
    baseUrl: PROJECTION_IDENTITY.owner.issuer,
    auth: { kind: "bearer", getAccessToken: () => undefined },
    fetch: async (request) => {
      const body = (await request.json()) as SyncBatchRequest;
      requests.push(body);
      for (const event of body.events) serverIds.add(event.id);
      if (requests.length === 1)
        throw new Error("Lost acknowledgement after scripted server commit");
      const response = answer(
        body.events.map((event) => ({
          id: event.id,
          status: "in_review",
          code: "fuel_efficiency_review",
          params: { efficiency_km_l: "14.99" },
        })),
      );
      assert.ok(response.ok);
      return Response.json(response.response);
    },
  });
  const pass = {
    outbox: reopened.outbox,
    kv: reopened.kv,
    deviceId: PROJECTION_IDENTITY.owner.deviceId,
    now: () => NOW,
    transport: createSyncTransport(client),
    attachments: {
      selection: reopened.attachments.session.selection,
      recoverInterrupted: () => Promise.resolve(),
      advanceOne: () => Promise.resolve(false),
      nextRetryDelayMs: () => Promise.resolve(null),
    },
  };
  assert.equal((await runSyncPass(pass, { batchSize: 50 })).kind, "retry");
  assert.equal((await service.read()).event?.status, "pending");
  await runSyncPass(pass, { batchSize: 50 });
  assert.deepEqual(
    requests.map((request) => request.events),
    [[original.event.envelope], [original.event.envelope]],
  );
  assert.deepEqual([...serverIds], [id]);
  const received = await service.read();
  assert.equal(received.event?.status, "in_review");
  assert.deepEqual(received.draft, original.draft);
  const review = {
    ...REVIEW_HISTORY,
    id: receiptId(690),
    source_event_id: id,
    source_code: "fuel_efficiency_review",
  };
  const unrelated = {
    ...review,
    id: receiptId(691),
    source_event_id: receiptId(692),
    revision: 99,
  };
  const older = { ...review, id: receiptId(693), revision: 1 };
  await reopened.bundle.applyProjectionChanges(
    projectionChanges({
      history: [historyChange(review), historyChange(unrelated), historyChange(older)],
    }),
  );
  const reviewed = await service.read();
  assert.equal(reviewed.review?.id, review.id);
  assert.deepEqual(reviewed.draft, original.draft);
  assert.deepEqual(reviewed.event, received.event);
  assert.equal(
    (await reopened.db.query("SELECT id FROM outbox_event WHERE type='fuel.load'")).length,
    1,
  );
});

void test("M11 an in-flight retake cannot overwrite newer input and revocation retains the unsaved draft", async (t) => {
  const h = await harness(t),
    id = await filled(h);
  const entered = deferred<undefined>(),
    result = deferred<{ id: string; fileRef: string }>();
  h.camera(() => {
    entered.resolve(undefined);
    return result.promise;
  });
  const photo = h.service.photo(id);
  await entered.promise;
  await h.service.edit("litres", "5.25", id);
  result.resolve({ id: receiptId(650), fileRef: pathToFileURL(h.source).href });
  await assert.rejects(photo);
  assert.equal((await h.service.read()).draft?.litres, "5.25");
  assert.equal((await h.service.read()).draft?.receipt, null);
  await h.bundle.revoke();
  await assert.rejects(h.service.save(id));
  const retained = await h.service.read();
  assert.equal(retained.ready, false);
  assert.equal(retained.draft?.litres, "5.25");
  assert.equal(retained.event, null);
});

void test("M11 an original shift guard rejects camera completion after a replacement shift is published", async (t) => {
  const h = await harness(t),
    id = await filled(h);
  await h.service.photo(id);
  const original = (await h.service.read()).draft;
  assert.ok(original?.receipt);
  const entered = deferred<undefined>(),
    result = deferred<{ id: string; fileRef: string }>();
  h.camera(() => {
    entered.resolve(undefined);
    return result.promise;
  });
  const photo = h.service.photo(id);
  await entered.promise;
  await h.setShift({ ...ORIGINAL_SHIFT, id: receiptId(700), motorcycleCode: "M-04" });
  result.resolve({ id: receiptId(701), fileRef: pathToFileURL(h.source).href });
  await assert.rejects(photo);
  const retained = await h.service.read();
  assert.deepEqual(retained.draft, original);
  assert.equal(retained.ready, false);
  assert.equal(retained.event, null);
  assert.deepEqual(await readFile(original.receipt.fileRef), PNG_BYTES);
});
