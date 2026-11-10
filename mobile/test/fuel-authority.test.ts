import assert from "node:assert/strict";
import { test } from "node:test";
import { createStores, FIXED_NOW, makeEnvelope } from "./support/factories.ts";
import { AttachmentStore } from "../src/attachments/attachment-store.ts";
import { OWNER, EVIDENCE_ID } from "./support/attachment-fixtures.ts";
import { DayStore } from "../src/features/day/store.ts";
import { DayBundleService } from "../src/features/day/bundle-service.ts";
import { setStatement } from "../src/db/kv-store.ts";
import { OutboxRepository } from "../src/outbox/outbox-repository.ts";
import { PROJECTION_IDENTITY, projectionBundle } from "./support/lifecycle-projection-fixtures.ts";

void test("fuel capture consumes current downloaded scope and original profile CAS without inferring upload permission", async () => {
  const { db } = await createStores();
  let body = projectionBundle();
  const bundle = new DayBundleService({
    store: new DayStore(db),
    now: () => FIXED_NOW,
    getCaptureIdentity: () => PROJECTION_IDENTITY,
    transport: () => Promise.resolve({ kind: "bundle", body }),
  });
  const profile = {
    issuer: PROJECTION_IDENTITY.owner.issuer,
    sessionId: PROJECTION_IDENTITY.sessionId,
    userId: PROJECTION_IDENTITY.owner.userId,
    organization: { id: PROJECTION_IDENTITY.owner.organizationId },
    permissions: ["field_event.sync", "field.upload"],
  };
  await db.runAtomically([setStatement("session_profile", JSON.stringify(profile))]);
  await assert.rejects(bundle.withFuelContext((source) => Promise.resolve(source)));
  await bundle.refresh();
  const original = await bundle.withFuelContext((source) => Promise.resolve(source));
  assert.equal(original.canUpload, true);
  assert.equal((await db.query(original.guard.sql, original.guard.params)).length, 1);
  await db.runAtomically([
    setStatement(
      "session_profile",
      JSON.stringify({ ...profile, permissions: ["field_event.sync"] }),
    ),
  ]);
  assert.equal((await db.query(original.guard.sql, original.guard.params)).length, 0);
  assert.equal(await bundle.withFuelContext((source) => Promise.resolve(source.canUpload)), false);
  await db.runAtomically([
    setStatement("session_profile", JSON.stringify({ ...profile, permissions: ["field.upload"] })),
  ]);
  await assert.rejects(bundle.withFuelContext((source) => Promise.resolve(source)));
  await db.runAtomically([setStatement("session_profile", JSON.stringify(profile))]);
  body = { ...body, capture_context: { ...body.capture_context, grants: [] } };
  await bundle.refresh(true);
  await assert.rejects(bundle.withFuelContext((source) => Promise.resolve(source)));
});

void test("fuel receipt claim and retry wait for exact enrollment and verification while receipt-less work proceeds", async () => {
  const { db, outbox } = await createStores();
  const store = new AttachmentStore(db);
  const fence = await store.bindSession({ owner: OWNER, sessionId: "fuel-session" });
  assert.ok(fence);
  const selection = { fence, isFinal: false };
  const withReceipt = makeEnvelope({
    type: "fuel.load",
    shift_id: OWNER.deviceId,
    payload: { receipt_upload_id: EVIDENCE_ID },
  });
  const withoutReceipt = makeEnvelope({ type: "fuel.load", payload: { receipt_upload_id: null } });
  const close = makeEnvelope({ type: "shift.close", shift_id: withReceipt.shift_id });
  await outbox.enqueue(withReceipt);
  await outbox.enqueue(withoutReceipt);
  await outbox.enqueue(close);
  await db.runAtomically([
    {
      sql: "UPDATE outbox_event SET retry_at=? WHERE id=?",
      params: [FIXED_NOW.toISOString(), withReceipt.id],
    },
  ]);
  assert.equal(await outbox.nextRetryDelayMs(selection), null);
  assert.deepEqual(
    (await outbox.claimPending(50, selection)).map((event) => event.envelope.id),
    [withoutReceipt.id],
  );
  await store.reserve({ id: EVIDENCE_ID, draftId: withReceipt.id, fence });
  await store.saveOwned(
    {
      id: EVIDENCE_ID,
      fileRef: "owned-fuel-receipt",
      contentType: "image/png",
      sizeBytes: 4,
      sha256: "a".repeat(64),
    },
    fence,
  );
  const attemptVersion = await store.beginAttempt(EVIDENCE_ID, fence);
  assert.ok(attemptVersion);
  await store.saveProgress({
    id: EVIDENCE_ID,
    fence,
    state: "verified",
    verifiedAt: FIXED_NOW.toISOString(),
    attemptVersion,
  });
  assert.deepEqual(
    await outbox.claimPending(50, selection),
    [],
    "unbound verification is not this event's receipt",
  );
  await db.runAtomically(
    store.bindingStatements({ eventId: withReceipt.id, evidenceIds: [EVIDENCE_ID], fence }),
  );
  assert.equal(await outbox.nextRetryDelayMs(selection), 0);
  assert.deepEqual(
    (await outbox.claimPending(50, selection)).map((event) => event.envelope.id),
    [withReceipt.id],
  );
  await outbox.settle([
    { id: withReceipt.id, action: "accept", result: { code: "accepted", params: {} } },
  ]);
  assert.deepEqual(
    (await outbox.claimPending(50, selection)).map((event) => event.envelope.id),
    [close.id],
  );
});

void test("final JSON can retain a fuel receipt declaration without claiming its bytes were uploaded", async () => {
  const { outbox } = await createStores();
  const event = makeEnvelope({
    type: "fuel.load",
    shift_id: OWNER.deviceId,
    payload: { receipt_upload_id: EVIDENCE_ID },
  });
  const close = makeEnvelope({ type: "shift.close", shift_id: event.shift_id });
  const opening = makeEnvelope({ type: "shift.open", shift_id: event.shift_id });
  await outbox.enqueue(opening);
  await outbox.enqueue(event);
  await outbox.enqueue(close);
  const [claimedOpening, claimed, claimedClose] = await outbox.claimPending(3, {
    fence: null,
    isFinal: true,
  });
  assert.deepEqual(claimedOpening?.envelope, opening);
  assert.deepEqual(claimed?.envelope, event);
  assert.deepEqual(claimedClose?.envelope, close);
});

void test("close JSON cannot overtake an earlier same-shift fuel retry and a review receipt releases it", async () => {
  const { outbox } = await createStores();
  const fuel = makeEnvelope({
    type: "fuel.load",
    shift_id: OWNER.deviceId,
    payload: { receipt_upload_id: null },
  });
  await outbox.enqueue(fuel);
  await outbox.claimPending(1);
  await outbox.settle([
    {
      id: fuel.id,
      action: "failTransient",
      retryAt: new Date(FIXED_NOW.getTime() + 60_000).toISOString(),
    },
  ]);
  const close = makeEnvelope({ type: "shift.close", shift_id: fuel.shift_id });
  const unrelated = makeEnvelope();
  await outbox.enqueue(close);
  await outbox.enqueue(unrelated);
  const selection = { fence: null, isFinal: false };
  assert.deepEqual(
    (await outbox.claimPending(50, selection)).map((event) => event.envelope.id),
    [unrelated.id],
  );
  assert.equal(await outbox.nextRetryDelayMs(selection), 60_000);
  await outbox.settle([
    {
      id: fuel.id,
      action: "pulledInReview",
      result: { code: "fuel_efficiency_review", params: {} },
    },
  ]);
  assert.deepEqual(
    (await outbox.claimPending(50, selection)).map((event) => event.envelope.id),
    [close.id],
  );
});

void test("fuel JSON waits for its retried shift opening receipt while unrelated work proceeds", async () => {
  const { db } = await createStores();
  let now = FIXED_NOW;
  const outbox = new OutboxRepository(db, () => now);
  const selection = { fence: null, isFinal: false };
  const opening = makeEnvelope({ type: "shift.open", shift_id: OWNER.deviceId });
  await outbox.enqueue(opening);
  await outbox.claimPending(1, selection);
  const retryAt = new Date(FIXED_NOW.getTime() + 60_000);
  await outbox.settle([
    { id: opening.id, action: "failTransient", retryAt: retryAt.toISOString() },
  ]);
  const fuel = makeEnvelope({
    type: "fuel.load",
    shift_id: opening.shift_id,
    payload: { receipt_upload_id: null },
  });
  const unrelated = makeEnvelope();
  await outbox.enqueue(fuel);
  await outbox.enqueue(unrelated);
  assert.deepEqual(
    (await outbox.claimPending(50, selection)).map((event) => event.envelope.id),
    [unrelated.id],
  );
  assert.equal(await outbox.nextRetryDelayMs(selection), 60_000);
  now = retryAt;
  assert.deepEqual(
    (await outbox.claimPending(50, selection)).map((event) => event.envelope.id),
    [opening.id],
  );
  await outbox.settle([
    { id: opening.id, action: "accept", result: { code: "accepted", params: {} } },
  ]);
  assert.deepEqual(
    (await outbox.claimPending(50, selection)).map((event) => event.envelope.id),
    [fuel.id],
  );
});

void test("fuel dependencies retain sending and parked predecessors until retry receives its original UUID", async () => {
  for (const [parentType, childType] of [
    ["shift.open", "fuel.load"],
    ["fuel.load", "shift.close"],
  ] as const) {
    const { outbox } = await createStores();
    const selection = { fence: null, isFinal: false };
    const parent = makeEnvelope({
      type: parentType,
      shift_id: OWNER.deviceId,
      payload: { receipt_upload_id: null },
    });
    const child = makeEnvelope({
      type: childType,
      shift_id: parent.shift_id,
      payload: { receipt_upload_id: null },
    });
    await outbox.enqueue(parent);
    await outbox.claimPending(1, selection);
    await outbox.enqueue(child);
    await outbox.settle([{ id: parent.id, action: "failPermanent" }]);
    assert.deepEqual(
      await outbox.claimPending(50, selection),
      [],
      `${parentType} needs a deliberate retry`,
    );
    assert.equal(await outbox.retryParked(), 1);
    const [retried] = await outbox.claimPending(50, selection);
    assert.deepEqual(retried?.envelope, parent);
    assert.deepEqual(
      await outbox.claimPending(50, selection),
      [],
      `${parentType} is still sending`,
    );
    await outbox.settle([
      { id: parent.id, action: "accept", result: { code: "accepted", params: {} } },
    ]);
    assert.deepEqual(
      (await outbox.claimPending(50, selection)).map((event) => event.envelope.id),
      [child.id],
    );
  }
});
