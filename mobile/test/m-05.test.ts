import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiClient } from "@wolbachia/api-client";
import { readFile } from "node:fs/promises";
import {
  ReceiptError,
  quantityValue,
  validQuantity,
  validateReceipt,
  scanReceipt,
  receiptEvent,
} from "../src/features/supply-receipt/domain.ts";
import { newReceiptDraft } from "../src/features/supply-receipt/new-draft.ts";
import type { ReceiptDraft } from "../src/features/supply-receipt/receipt-types.ts";
import {
  receiptHarness,
  receiptId,
  supplyAssignment,
  RECEIPT_SIGNATURE_ID,
} from "./support/m-05-fixtures.ts";
import { PROJECTION_IDENTITY, projectionChanges } from "./support/lifecycle-projection-fixtures.ts";
import { NOW, PNG_BYTES } from "./support/attachment-fixtures.ts";
import { ownerKey } from "../src/attachments/types.ts";
import { deferred } from "./support/auth-fakes.ts";
import { makeEnvelope } from "./support/factories.ts";
import { runSyncPass } from "../src/sync/sync-pass.ts";
import { createSyncTransport } from "../src/sync/sync-transport.ts";
import type { SyncBatchRequest } from "../src/sync/sync-transport.ts";
import { answer, accepted } from "./support/scripted-transport.ts";
import { OutboxWriteError } from "../src/outbox/outbox-repository.ts";
import {
  REVIEW_HISTORY,
  SHIFT_HISTORY,
  historyChange,
} from "./support/lifecycle-contract-fixtures.ts";

function draft(patch: Partial<ReceiptDraft> = {}): ReceiptDraft {
  let sequence = 200;
  const original = newReceiptDraft({
    assignment: supplyAssignment(),
    releaseId: receiptId(8),
    ownerKey: ownerKey(PROJECTION_IDENTITY.owner),
    shiftId: receiptId(50),
    versions: { rules: "rules-m05", catalog: "catalog-m05" },
    now: NOW,
    uuid: () => receiptId(sequence++),
  });
  return {
    ...original,
    lines: original.lines.map((line) => ({ ...line, quantity: line.expected })),
    signature: { id: RECEIPT_SIGNATURE_ID, fileRef: "retained-original.png" },
    ...patch,
  };
}
const code = (expected: string) => (error: unknown) =>
  error instanceof ReceiptError && error.code === expected;
function required<Value>(value: Value | null | undefined): Value {
  assert.ok(value);
  return value;
}

void test("M05 receipt requires the actual signature and an explicit mismatch or Other explanation", () => {
  assert.throws(() => {
    validateReceipt(draft({ signature: null }));
  }, code("signature_required"));
  const original = draft();
  const mismatch = {
    ...original,
    lines: original.lines.map((line) => ({ ...line, quantity: "0" })),
  };
  assert.throws(() => {
    validateReceipt(mismatch);
  }, code("discrepancy_required"));
  assert.doesNotThrow(() => {
    validateReceipt({ ...mismatch, discrepancy: { kind: "missing", text: "" } });
  });
  assert.throws(() => {
    validateReceipt({ ...mismatch, discrepancy: { kind: "other", text: "  " } });
  }, code("other_required"));
  assert.doesNotThrow(() => {
    validateReceipt({
      ...mismatch,
      discrepancy: { kind: "other", text: "Different sealed package" },
    });
  });
  assert.throws(() => {
    validateReceipt({ ...original, discrepancy: { kind: "damaged", text: "Wet package" } });
  }, code("evidence_required"));
});

void test("M05 quantities retain Decimal6 declared units and indivisible pieces without conversion", () => {
  const line = required(draft().lines[0]);
  assert.equal(quantityValue("0.100001"), 100001n);
  assert.equal(quantityValue("99999999999999.999999"), 99999999999999999999n);
  for (const quantity of ["-1", "1e2", "1.0000001", "100000000000000", "1,5", " 1", "NaN"]) {
    assert.equal(validQuantity({ ...line, quantity }), false, quantity);
  }
  assert.equal(validQuantity({ ...line, quantity: "2.000001" }), false);
  assert.equal(validQuantity({ ...line, pieceId: receiptId(40), quantity: "0.5" }), false);
  assert.equal(validQuantity({ ...line, pieceId: receiptId(40), quantity: "1" }), true);
  assert.equal(validQuantity({ ...line, quantity: "0.000001" }), true);
  const event = receiptEvent(draft());
  assert.deepEqual(event.payload.actual_lines, [
    { id: line.id, release_line_id: line.releaseLineId, quantity: "2.000000" },
  ]);
});

void test("M05 duplicate lot scans only change feedback and generic rejection preserves every received line", () => {
  const original = draft({ signature: null });
  const piece = {
    ...original,
    lines: original.lines.map((line) => ({
      ...line,
      pieceId: receiptId(40),
      quantity: "0",
      expected: "1",
    })),
  };
  const first = scanReceipt(piece, `wbf:1:lot:${receiptId(6)}`);
  assert.equal(first.feedback, "added");
  assert.equal(first.draft.lines[0]?.quantity, "1");
  const second = scanReceipt(first.draft, `wbf:1:lot:${receiptId(6)}`);
  assert.equal(second.feedback, "duplicate");
  assert.equal(second.draft, first.draft);
  for (const value of [`wbf:1:bag:${receiptId(6)}`, `wbf:1:lot:${receiptId(99)}`, receiptId(6)]) {
    const result = scanReceipt(piece, value);
    assert.equal(result.feedback, "invalid");
    assert.equal(result.draft, piece);
  }
  const ambiguous = {
    ...piece,
    lines: [
      ...piece.lines,
      { ...required(piece.lines[0]), id: receiptId(41), pieceId: receiptId(42) },
    ],
  };
  assert.equal(scanReceipt(ambiguous, `wbf:1:lot:${receiptId(6)}`).feedback, "invalid");
  const countable = scanReceipt(
    { ...original, lines: original.lines.map((line) => ({ ...line, quantity: "0" })) },
    `wbf:1:lot:${receiptId(6)}`,
  );
  assert.equal(countable.draft.lines[0]?.quantity, "0");
});

async function signedReceipt(h: Awaited<ReturnType<typeof receiptHarness>>) {
  await h.service.begin(receiptId(1), receiptId(8));
  const state = await h.service.read();
  assert.ok(state.draft);
  await h.service.quantity(required(state.draft.lines[0]).id, "2.000000");
  await h.service.signature(h.photo);
  return required((await h.service.read()).draft);
}

void test("M05 signed local receipt survives restart and assignment change, then lost HTTP acknowledgement retries the original UUID once", async (t) => {
  const h = await receiptHarness(t),
    signed = await signedReceipt(h);
  assert.equal((await h.service.read()).signaturePending, true);
  await h.service.save();
  await h.engine.requestSync();
  assert.equal((await h.service.read()).event?.status, "pending");
  const originalPayload = receiptEvent(signed);
  const reopened = await h.reopen();
  assert.deepEqual((await reopened.service.read()).draft, signed);
  assert.deepEqual(await readFile(required(signed.signature).fileRef), PNG_BYTES);
  const changed = {
    ...supplyAssignment(),
    revision: 2,
    version_id: receiptId(70),
    lines: supplyAssignment().lines.map((line) => ({ ...line, quantity: "1" })),
  };
  await reopened.bundle.applyProjectionChanges(
    projectionChanges({
      supplies: [
        {
          action: "upsert",
          resource_type: "supply_assignment",
          resource_id: changed.id,
          resource_version: "plan-2",
          sequence: 30,
          data: changed,
        },
      ],
    }),
  );
  assert.equal((await reopened.service.read()).draft?.planRevision, 1);
  const selection = await reopened.attachments.session.selection();
  assert.deepEqual(await reopened.outbox.claimPending(50, selection), []);
  await verifySignature(reopened, RECEIPT_SIGNATURE_ID);
  const requests: SyncBatchRequest[] = [];
  const client = createApiClient({
    baseUrl: PROJECTION_IDENTITY.owner.issuer,
    auth: { kind: "bearer", getAccessToken: () => undefined },
    fetch: async (request) => {
      const body = (await request.json()) as SyncBatchRequest;
      requests.push(body);
      if (requests.length === 1)
        throw new Error("Lost acknowledgement after server stored receipt");
      const response = answer(
        body.events.map((event) => ({
          id: event.id,
          status: "in_review",
          code: "supply_assignment_changed",
          params: {},
        })),
      );
      if (!response.ok) throw new Error("Invalid test response");
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
  await runSyncPass(pass, { batchSize: 50 });
  assert.deepEqual(
    requests.map((request) => request.events),
    [[originalPayload], [originalPayload]],
  );
  const restored = await reopened.service.read();
  assert.ok(restored.event);
  assert.equal(restored.event.status, "in_review");
  assert.equal(restored.event.result?.code, "supply_assignment_changed");
  assert.equal(
    (await reopened.db.query("SELECT id FROM outbox_event WHERE type='supplies.receive'")).length,
    1,
  );
  assert.deepEqual(restored.draft, signed);
});

async function verifySignature(
  local: Awaited<ReturnType<Awaited<ReturnType<typeof receiptHarness>>["reopen"]>>,
  id: string,
) {
  const fence = await local.attachments.session.capture();
  const attemptVersion = await local.attachments.store.beginAttempt(id, fence);
  assert.notEqual(attemptVersion, null);
  assert.equal(
    await local.attachments.store.saveProgress({
      id,
      fence,
      state: "verified",
      verifiedAt: NOW.toISOString(),
      attemptVersion: required(attemptVersion),
    }),
    true,
  );
}

void test("M05 failed event storage rolls back signed capture enrollment and permits the same immutable retry", async (t) => {
  const h = await receiptHarness(t),
    signed = await signedReceipt(h);
  h.failSave();
  await assert.rejects(h.service.save(), OutboxWriteError);
  assert.equal((await h.service.read()).event, null);
  assert.equal((await h.db.query("SELECT id FROM outbox_event")).length, 0);
  assert.equal((await h.db.query("SELECT evidence_id FROM attachment_event")).length, 0);
  assert.deepEqual((await h.service.read()).draft, signed);
  await h.service.save();
  await h.engine.requestSync();
  assert.equal((await h.service.read()).event?.envelope.id, signed.eventId);
  await assert.rejects(h.service.quantity(required(signed.lines[0]).id, "0"), code("stale_draft"));
});

void test("M05 unverified signature blocks its JSON before LIMIT while unrelated events still sync", async (t) => {
  const h = await receiptHarness(t),
    signed = await signedReceipt(h);
  await h.service.save();
  await h.engine.requestSync();
  const unrelated = makeEnvelope({ type: "shift.open", payload: {} });
  await h.outbox.enqueue(unrelated);
  const requests: SyncBatchRequest[] = [];
  await runSyncPass(
    {
      outbox: h.outbox,
      kv: h.kv,
      deviceId: PROJECTION_IDENTITY.owner.deviceId,
      now: () => NOW,
      transport: (request) => {
        requests.push(request);
        return Promise.resolve(answer(request.events.map((event) => accepted(event.id))));
      },
      attachments: {
        selection: h.attachments.session.selection,
        recoverInterrupted: () => Promise.resolve(),
        advanceOne: () => Promise.resolve(false),
        nextRetryDelayMs: () => Promise.resolve(null),
      },
    },
    { batchSize: 1 },
  );
  assert.deepEqual(
    requests.flatMap((request) => request.events.map((event) => event.id)),
    [unrelated.id],
  );
  assert.equal((await h.service.read()).event?.status, "pending");
  assert.equal(
    (
      await h.db.query("SELECT state FROM attachment_file WHERE id=?", [
        required(signed.signature).id,
      ])
    )[0]?.state,
    "ready",
  );
});

void test("M05 no-file draft prevents another owner and session ABA fences delayed signature adoption", async (t) => {
  const h = await receiptHarness(t);
  await h.service.begin(receiptId(1), receiptId(8));
  const original = required((await h.service.read()).draft);
  await h.service.quantity(required(original.lines[0]).id, "2");
  const before = required((await h.service.read()).draft);
  await assert.rejects(
    h.attachments.store.bindSession(
      {
        owner: { ...PROJECTION_IDENTITY.owner, userId: receiptId(80) },
        sessionId: "different-owner",
      },
      true,
    ),
    /owner_conflict/,
  );
  const entered = deferred<undefined>(),
    release = deferred<undefined>();
  const pending = h.service.signature({
    capture: async () => {
      entered.resolve(undefined);
      await release.promise;
      return { id: RECEIPT_SIGNATURE_ID, fileRef: h.source };
    },
  });
  await entered.promise;
  await h.attachments.store.bindSession({
    ...PROJECTION_IDENTITY,
    sessionId: "replacement-session",
  });
  await h.attachments.store.bindSession(PROJECTION_IDENTITY);
  release.resolve(undefined);
  await assert.rejects(pending, /stale_context|stale_draft/);
  assert.deepEqual((await h.service.read()).draft, before);
  assert.equal((await h.db.query("SELECT id FROM attachment_file")).length, 0);
});

void test("M05 an already signed observation keeps its original plan and units when a newer plan arrives before Save", async (t) => {
  const h = await receiptHarness(t),
    signed = await signedReceipt(h);
  const changed = {
    ...supplyAssignment(),
    revision: 2,
    version_id: receiptId(70),
    lines: supplyAssignment().lines.map((line) => ({ ...line, quantity: "1" })),
  };
  await h.bundle.applyProjectionChanges(
    projectionChanges({
      supplies: [
        {
          action: "upsert",
          resource_type: "supply_assignment",
          resource_id: changed.id,
          resource_version: "plan-2",
          sequence: 30,
          data: changed,
        },
      ],
    }),
  );
  await h.service.save(signed.eventId);
  await h.engine.requestSync();
  const state = await h.service.read();
  assert.deepEqual(state.draft, signed);
  assert.deepEqual(state.event?.envelope, receiptEvent(signed));
  assert.equal(state.assignments[0]?.revision, 2);
});

void test("M05 delayed callbacks from an older receipt screen cannot edit or save the newly selected receipt", async (t) => {
  const h = await receiptHarness(t),
    assignment = supplyAssignment();
  const firstRelease = required(assignment.releases[0]);
  h.setAssignment({
    ...assignment,
    releases: [
      firstRelease,
      {
        ...firstRelease,
        id: receiptId(81),
        lines: firstRelease.lines.map((line) => ({ ...line, id: receiptId(82) })),
      },
    ],
  });
  await h.bundle.refresh();
  await h.service.begin(assignment.id, firstRelease.id);
  const original = required((await h.service.read()).draft);
  await h.service.begin(assignment.id, receiptId(81));
  const selected = required((await h.service.read()).draft);
  assert.notEqual(selected.eventId, original.eventId);
  const callbacks = [
    () => h.service.quantity(required(original.lines[0]).id, "1", original.eventId),
    () => h.service.discrepancy("other", "Late editor input", original.eventId),
    () => h.service.strokes(["M1 1 L2 2"], original.eventId),
    () => h.service.scan(`wbf:1:lot:${receiptId(6)}`, original.eventId),
    () => h.service.manual(receiptId(6), original.eventId),
    () => h.service.signature(h.photo, original.eventId),
    () => h.service.save(original.eventId),
  ];
  for (const callback of callbacks) await assert.rejects(callback, code("stale_draft"));
  assert.deepEqual((await h.service.read()).draft, selected);
  assert.equal((await h.db.query("SELECT id FROM attachment_file")).length, 0);
  assert.equal((await h.db.query("SELECT id FROM outbox_event")).length, 0);
});

void test("M05 canonical review history shows the latest exact receipt decision without rewriting ingestion and hides it after context loss", async (t) => {
  const h = await receiptHarness(t),
    signed = await signedReceipt(h);
  await h.service.save(signed.eventId);
  await h.engine.requestSync();
  await verifySignature(h, RECEIPT_SIGNATURE_ID);
  const pending = await h.outbox.claimPending(50, await h.attachments.session.selection());
  assert.deepEqual(
    pending.map((event) => event.envelope.id),
    [signed.eventId],
  );
  await h.outbox.settle([
    {
      id: signed.eventId,
      action: "review",
      result: { code: "supply_assignment_changed", params: {} },
    },
  ]);
  const receipt = (await h.service.read()).event;
  const incident = {
    ...REVIEW_HISTORY,
    id: receiptId(90),
    review_item_id: receiptId(91),
    source_event_id: signed.eventId,
    revision: 1,
    decision_kind: "open_incident" as const,
    is_terminal: false,
    decision_state: "pending" as const,
    effect_state: "incident_open" as const,
    incident_id: receiptId(92),
    source_code: "supply_assignment_changed",
  };
  const unrelated = {
    ...REVIEW_HISTORY,
    id: receiptId(93),
    source_event_id: receiptId(94),
    revision: 99,
  };
  const shift = {
    ...SHIFT_HISTORY,
    id: receiptId(95),
    source_event_id: null,
    shift_id: signed.shiftId,
    revision: 100,
  };
  await h.bundle.applyProjectionChanges(
    projectionChanges({
      history: [historyChange(incident), historyChange(unrelated), historyChange(shift)],
    }),
  );
  const opened = await h.service.read();
  assert.ok(opened.review);
  assert.equal(opened.review.id, incident.id);
  assert.equal(opened.review.incident_id, incident.incident_id);
  assert.equal(opened.review.is_terminal, false);
  assert.deepEqual(opened.event, receipt);
  const acceptedReview = {
    ...REVIEW_HISTORY,
    id: receiptId(96),
    review_item_id: incident.review_item_id,
    source_event_id: signed.eventId,
    revision: 2,
    source_code: "supply_assignment_changed",
  };
  await h.bundle.applyProjectionChanges(
    projectionChanges({
      history: [
        {
          ...historyChange(acceptedReview),
          sequence: 9,
          resource_version: "opaque:accepted-publication",
        },
      ],
    }),
  );
  const acceptedState = await h.service.read();
  assert.ok(acceptedState.review);
  assert.equal(acceptedState.review.id, acceptedReview.id);
  assert.equal(acceptedState.review.is_terminal, true);
  assert.equal(acceptedState.review.effect_state, "applied_review");
  assert.deepEqual(acceptedState.event, receipt);
  await h.bundle.clearSessionData();
  const unavailable = await h.service.read();
  assert.equal(unavailable.ready, false);
  assert.equal(unavailable.review, null);
  assert.deepEqual(unavailable.event, receipt);
  assert.deepEqual(unavailable.draft, signed);
});

void test("M05 lock before native invocation denies capture while an already launched same-session signature can finish privately", async (t) => {
  const h = await receiptHarness(t);
  await h.service.begin(receiptId(1), receiptId(8));
  const original = required((await h.service.read()).draft);
  await h.service.quantity(required(original.lines[0]).id, "2");
  const before = required((await h.service.read()).draft);
  const prepared = deferred<undefined>(),
    continuePreparation = deferred<undefined>();
  const capture = h.attachments.session.capture.bind(h.attachments.session);
  let captureCalls = 0,
    nativeCalls = 0;
  h.attachments.session.capture = async () => {
    const fence = await capture();
    captureCalls += 1;
    if (captureCalls === 2) {
      prepared.resolve(undefined);
      await continuePreparation.promise;
    }
    return fence;
  };
  const denied = h.service.signature(
    {
      capture: () => {
        nativeCalls += 1;
        return Promise.resolve({ id: RECEIPT_SIGNATURE_ID, fileRef: h.source });
      },
    },
    original.eventId,
  );
  await prepared.promise;
  h.setCaptureAllowed(false);
  continuePreparation.resolve(undefined);
  await assert.rejects(denied, code("scope"));
  assert.equal(nativeCalls, 0);
  h.setCaptureAllowed(true);
  assert.deepEqual((await h.service.read()).draft, before);
  assert.equal((await h.db.query("SELECT id FROM attachment_file")).length, 0);
  h.attachments.session.capture = capture;
  const launched = deferred<undefined>(),
    completeNative = deferred<undefined>();
  const allowed = h.service.signature(
    {
      capture: async () => {
        nativeCalls += 1;
        launched.resolve(undefined);
        await completeNative.promise;
        return { id: RECEIPT_SIGNATURE_ID, fileRef: h.source };
      },
    },
    original.eventId,
  );
  await launched.promise;
  h.setCaptureAllowed(false);
  completeNative.resolve(undefined);
  await allowed;
  assert.equal(nativeCalls, 1);
  assert.equal((await h.service.read()).draft, null);
  h.setCaptureAllowed(true);
  const finished = await h.service.read();
  const signature = required(finished.draft?.signature);
  assert.equal(signature.id, RECEIPT_SIGNATURE_ID);
  assert.deepEqual(await readFile(signature.fileRef), PNG_BYTES);
  assert.equal(finished.event, null);
  assert.equal((await h.db.query("SELECT id FROM outbox_event")).length, 0);
});
