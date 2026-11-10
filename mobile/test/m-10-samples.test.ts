import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createApiClient } from "@wolbachia/api-client";
import { setStatement } from "../src/db/kv-store.ts";
import { runSyncPass } from "../src/sync/sync-pass.ts";
import { createSyncTransport } from "../src/sync/sync-transport.ts";
import type { SyncBatchRequest } from "../src/sync/sync-transport.ts";
import type { EvidencePort } from "../src/features/ovitrap-check/types.ts";
import { deferred } from "./support/auth-fakes.ts";
import { answer } from "./support/scripted-transport.ts";
import { PNG_BYTES } from "./support/attachment-fixtures.ts";
import { PROJECTION_IDENTITY } from "./support/lifecycle-projection-fixtures.ts";
import {
  SAMPLE_NOW,
  sampleId,
  sampleMethod,
  sampleProfile,
  sampleSnapshot,
} from "./support/sample-fixtures.ts";
import { sampleHarness, SAMPLE_SELECTION } from "./support/sample-service-fixtures.ts";
import type { SampleHarness } from "./support/sample-service-fixtures.ts";
import { makeEnvelope } from "./support/factories.ts";

async function prepared(h: SampleHarness) {
  const id = await h.local.service.begin(SAMPLE_SELECTION);
  await h.local.service.edit(id, {
    code: "  SAMPLE-139  ",
    originCode: "lot",
    methodVersion: sampleMethod().id,
  });
  await h.local.service.photo(id, () => true);
  await h.local.service.locate(id, () => true);
  return id;
}
function retryTransport(requests: SyncBatchRequest[]) {
  let attempts = 0;
  const client = createApiClient({
    baseUrl: PROJECTION_IDENTITY.owner.issuer,
    auth: { kind: "bearer", getAccessToken: () => undefined },
    fetch: async (request) => {
      const body = (await request.json()) as SyncBatchRequest;
      requests.push(body);
      if (body.events.length && ++attempts === 1) throw new Error("Scripted lost acknowledgement");
      const response = answer(
        body.events.map(({ id }) => ({
          id,
          status: "rejected",
          code: "lab_method_unverified",
          params: {},
        })),
      );
      assert.ok(response.ok);
      return Response.json(response.response);
    },
  });
  return createSyncTransport(client);
}
function syncPass(h: SampleHarness, requests: SyncBatchRequest[]) {
  const { attachments, outbox, kv } = h.local;
  return {
    outbox,
    kv,
    deviceId: PROJECTION_IDENTITY.owner.deviceId,
    now: () => h.clock,
    transport: retryTransport(requests),
    attachments: {
      selection: attachments.session.selection,
      recoverInterrupted: () => Promise.resolve(),
      advanceOne: () => attachments.sync.advanceOne(),
      nextRetryDelayMs: attachments.sync.nextRetryDelayMs,
    },
  };
}
void test("P20 saves offline with real adopted evidence and fresh GPS then reopens and retries the original UUID after lost acknowledgement", async (t) => {
  const h = await sampleHarness(t),
    id = await prepared(h),
    selection = { ...SAMPLE_SELECTION, sampleId: id };
  h.clock = new Date("2026-11-10T16:01:00Z");
  await h.local.service.save(id);
  const saved = await h.local.service.read(selection);
  assert.ok(saved.event);
  assert.ok(saved.draft);
  assert.equal(saved.event.status, "pending");
  assert.equal(saved.event.envelope.device_time, h.clock.toISOString());
  assert.equal(saved.event.envelope.gps?.accuracy_m, 7);
  assert.equal(h.requests.length, 0);
  assert.equal(saved.draft.code, "  SAMPLE-139  ");
  assert.equal(saved.event.envelope.payload.code, "SAMPLE-139");
  assert.notEqual(saved.event.envelope.id, id);
  assert.equal((await h.local.db.query("SELECT event_id FROM attachment_event")).length, 1);
  await h.reopen();
  await h.local.service.save(id);
  const requests: SyncBatchRequest[] = [],
    pass = syncPass(h, requests);
  assert.equal((await runSyncPass(pass, { batchSize: 50 })).kind, "retry");
  await runSyncPass(pass, { batchSize: 50 });
  const rejected = await h.local.service.read(selection);
  assert.ok(rejected.event);
  assert.equal(rejected.event.status, "rejected");
  assert.equal(rejected.event.result?.code, "lab_method_unverified");
  assert.deepEqual(rejected.event.envelope, saved.event.envelope);
  assert.deepEqual(rejected.draft, saved.draft);
  assert.deepEqual(
    requests.filter(({ events }) => events.length).map(({ events }) => events),
    [[saved.event.envelope], [saved.event.envelope]],
  );
  assert.equal(
    (await h.local.db.query("SELECT id FROM outbox_event WHERE type='sample.collect'")).length,
    1,
  );
  assert.equal(await h.local.service.begin(selection), id);
  assert.ok(saved.draft.evidence[0]);
  assert.deepEqual(await readFile(saved.draft.evidence[0].fileRef), PNG_BYTES);
});
void test("P20 evidence binding write failure leaves the raw draft and original UUID available for explicit retry", async (t) => {
  const h = await sampleHarness(t),
    id = await prepared(h),
    selection = { ...SAMPLE_SELECTION, sampleId: id };
  const before = await h.local.service.read(selection);
  assert.ok(before.draft);
  await h.local.db.runAtomically([
    {
      sql: "CREATE TRIGGER sample_fixture_failure BEFORE INSERT ON attachment_event BEGIN SELECT RAISE(ABORT,'fixture write failure'); END",
    },
  ]);
  await assert.rejects(h.local.service.save(id));
  const retained = await h.local.service.read(selection);
  assert.equal(retained.event, null);
  assert.equal(retained.draft?.code, before.draft.code);
  assert.equal(retained.draft.eventId, before.draft.eventId);
  assert.equal((await h.local.db.query("SELECT id FROM outbox_event")).length, 0);
  assert.equal((await h.local.db.query("SELECT evidence_id FROM attachment_event")).length, 0);
  await h.local.db.runAtomically([{ sql: "DROP TRIGGER sample_fixture_failure" }]);
  await h.local.service.save(id);
  assert.equal((await h.local.service.read(selection)).event?.envelope.id, before.draft.eventId);
});
void test("P20 a launched photo privately completes under local lock while raw edit and profile changes invalidate stale camera returns", async (t) => {
  const h = await sampleHarness(t),
    id = await h.local.service.begin(SAMPLE_SELECTION),
    selection = { ...SAMPLE_SELECTION, sampleId: id };
  const entered = deferred<undefined>(),
    captured = deferred<Awaited<ReturnType<EvidencePort["capture"]>>>();
  h.camera = () => {
    entered.resolve(undefined);
    return captured.promise;
  };
  const photo = h.local.service.photo(id, () => true);
  await entered.promise;
  h.isUnlocked = false;
  await assert.rejects(h.local.service.photo(id, () => true));
  captured.resolve({ id: sampleId(700), fileRef: pathToFileURL(h.source).href });
  await photo;
  assert.equal((await h.local.service.read(selection)).draft, null);
  h.isUnlocked = true;
  assert.equal((await h.local.service.read(selection)).draft?.evidence.length, 1);
  const nextEntered = deferred<undefined>(),
    nextPhoto = deferred<Awaited<ReturnType<EvidencePort["capture"]>>>();
  h.camera = () => {
    nextEntered.resolve(undefined);
    return nextPhoto.promise;
  };
  const stale = h.local.service.photo(id, () => true);
  await nextEntered.promise;
  await h.local.service.edit(id, { code: "raw edit while camera open" });
  await h.local.db.runAtomically([
    setStatement("session_profile", JSON.stringify({ ...sampleProfile(), permissions: [] })),
  ]);
  nextPhoto.resolve({ id: sampleId(701), fileRef: pathToFileURL(h.source).href });
  await assert.rejects(stale);
  assert.equal((await h.local.service.read(selection)).draft, null);
  const retained = await h.local.store.read(id, beforeOwner());
  assert.equal(retained?.draft.code, "raw edit while camera open");
  assert.equal(retained.draft.evidence.length, 1);
  assert.equal((await h.local.db.query("SELECT id FROM attachment_file")).length, 1);
});
function beforeOwner() {
  const owner = PROJECTION_IDENTITY.owner;
  return JSON.stringify([owner.issuer, owner.organizationId, owner.userId, owner.deviceId]);
}
void test("P20 pending sample transport holds close including future retry and only an exact genuine receipt clears its durable lab reminder", async (t) => {
  const h = await sampleHarness(t),
    opening = makeEnvelope({ id: sampleId(800), type: "shift.open", shift_id: sampleId(8) });
  await h.local.outbox.enqueue(opening);
  const id = await prepared(h),
    selected = { ...SAMPLE_SELECTION, sampleId: id };
  await h.local.service.save(id);
  const saved = await h.local.service.read(selected);
  assert.ok(saved.event);
  const close = makeEnvelope({ id: sampleId(801), type: "shift.close", shift_id: sampleId(8) });
  await h.local.outbox.enqueue(close);
  const selection = await h.local.attachments.session.selection();
  await h.local.db.runAtomically([
    {
      sql: "UPDATE outbox_event SET retry_at=? WHERE id=?",
      params: ["2026-11-10T17:00:00Z", opening.id],
    },
  ]);
  assert.deepEqual(await h.local.outbox.claimPending(50, selection), []);
  await h.local.db.runAtomically([
    { sql: "UPDATE outbox_event SET retry_at=NULL WHERE id=?", params: [opening.id] },
  ]);
  assert.deepEqual(
    (await h.local.outbox.claimPending(50, selection)).map(({ envelope }) => envelope.id),
    [opening.id],
  );
  await h.local.outbox.settle([
    { id: opening.id, action: "accept", result: { code: "accepted", params: {} } },
  ]);
  assert.deepEqual(await h.local.outbox.claimPending(50, selection), []);
  await h.local.db.runAtomically([
    {
      sql: "UPDATE outbox_event SET retry_at=? WHERE id=?",
      params: ["2026-11-10T17:00:00Z", saved.event.envelope.id],
    },
  ]);
  await h.local.attachments.sync.advanceOne();
  assert.deepEqual(await h.local.outbox.claimPending(50, selection), []);
  await h.local.db.runAtomically([
    { sql: "UPDATE outbox_event SET retry_at=NULL WHERE id=?", params: [saved.event.envelope.id] },
  ]);
  assert.deepEqual(
    (await h.local.outbox.claimPending(50, selection)).map(({ envelope }) => envelope.id),
    [saved.event.envelope.id],
  );
  await h.local.outbox.settle([
    { id: saved.event.envelope.id, action: "review", result: { code: "clock_skew", params: {} } },
  ]);
  assert.deepEqual(
    (await h.local.outbox.claimPending(50, selection)).map(({ envelope }) => envelope.id),
    [close.id],
  );
  await assertReceiptProof(h, id, saved.event.envelope.id);
});
async function assertReceiptProof(h: SampleHarness, id: string, eventId: string) {
  await h.closeShift();
  h.body = {
    ...h.body,
    sample_capture: sampleSnapshot({
      receipts: [{ sample_id: id, event_id: sampleId(890), received_at: SAMPLE_NOW.toISOString() }],
    }),
  };
  await h.local.bundle.refresh(true);
  assert.equal((await h.local.service.read(SAMPLE_SELECTION)).work[0]?.receiptAt, null);
  assert.equal(await h.local.service.admit(id, () => true), true);
  assert.equal(await h.local.service.admit(sampleId(891), () => true), false);
  h.body = {
    ...h.body,
    sample_capture: sampleSnapshot({
      receipts: [{ sample_id: id, event_id: eventId, received_at: SAMPLE_NOW.toISOString() }],
    }),
  };
  await h.local.bundle.refresh(true);
  const received = await h.local.service.read({ ...SAMPLE_SELECTION, sampleId: id });
  assert.equal(received.receipt?.event_id, eventId);
  assert.equal(received.work[0]?.receiptAt, SAMPLE_NOW.toISOString());
  assert.equal(received.event?.status, "in_review");
}
