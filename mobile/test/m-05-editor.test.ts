import assert from "node:assert/strict";
import { test } from "node:test";
import {
  receiptEditBuffer,
  runReceiptOperation,
} from "../src/features/supply-receipt/edit-buffer.ts";
import type { ReceiptDraft, ReceiptState } from "../src/features/supply-receipt/receipt-types.ts";

function state(): ReceiptState {
  const draft: ReceiptDraft = {
    eventId: "receipt",
    assignmentId: "assignment",
    releaseId: "release",
    planRevision: 1,
    expectedRevision: 0,
    ownerKey: "owner",
    shiftId: "shift",
    deviceTime: "2026-11-09T12:00:00Z",
    manualCapture: false,
    scannedIds: [],
    catalogVersion: "catalog",
    rulesVersion: "rules",
    lines: [],
    discrepancy: null,
    strokes: [],
    signature: null,
    evidence: [],
  };
  return {
    ready: true,
    assignments: [],
    drafts: [draft],
    draft,
    event: null,
    feedback: null,
    signaturePending: false,
  };
}

void test("P8 recovery remains reachable with failed input; remount preserves it and capture waits for durable retry", async () => {
  const service = {};
  const buffer = receiptEditBuffer(service);
  const original = state();
  const originalDraft = original.draft;
  assert.ok(originalDraft);
  let hasStorageFailure = true;
  let saved = original;
  const readSaved = () => saved;
  let hasCaptured = false;
  let hasRecovered = false;
  const capture = () => {
    hasCaptured = true;
    return Promise.resolve();
  };
  const edit = (text: string) => {
    const apply = (draft: ReceiptDraft): ReceiptDraft => ({
      ...draft,
      discrepancy: { kind: "other", text },
    });
    buffer.edit("discrepancy", {
      eventId: "receipt",
      apply,
      write: () => {
        if (hasStorageFailure) return Promise.reject(new Error("Storage unavailable"));
        assert.ok(saved.draft);
        saved = { ...saved, draft: apply(saved.draft) };
        return Promise.resolve();
      },
    });
  };
  edit("first explanation");
  await assert.rejects(
    runReceiptOperation({ buffer, operation: capture, shouldPersist: true }),
    /Storage unavailable/,
  );
  assert.equal(hasCaptured, false);
  await runReceiptOperation({
    buffer,
    operation: () => {
      hasRecovered = true;
      return Promise.resolve();
    },
    shouldPersist: false,
  });
  assert.equal(hasRecovered, true);
  assert.equal(buffer.hasPending, true);
  assert.equal(saved.draft?.discrepancy, null);
  const remounted = receiptEditBuffer(service);
  assert.equal(remounted.merge(saved).draft?.discrepancy?.text, "first explanation");
  assert.equal(
    remounted.merge({ ...original, draft: { ...originalDraft, eventId: "another" } }).draft
      ?.discrepancy,
    null,
  );
  edit("corrected explanation");
  hasStorageFailure = false;
  await runReceiptOperation({ buffer: remounted, operation: capture, shouldPersist: true });
  assert.equal(hasCaptured, true);
  assert.equal(buffer.hasPending, false);
  assert.equal(readSaved().draft?.discrepancy?.text, "corrected explanation");
  assert.equal(remounted.merge(original).draft?.discrepancy, null);
});
