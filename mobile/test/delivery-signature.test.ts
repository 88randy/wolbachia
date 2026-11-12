import assert from "node:assert/strict";
import { test } from "node:test";
import { receiptEvent, validateReceipt } from "../src/features/supply-receipt/domain.ts";
import { newReceiptDraft } from "../src/features/supply-receipt/new-draft.ts";
import { countPendingDeliveries } from "../src/features/supply-receipt/pending-deliveries.ts";
import { signatureModeFromRules } from "../src/features/supply-receipt/signature-need.ts";
import type { SignatureMode } from "../src/features/supply-receipt/signature-need.ts";
import { receiptId, supplyAssignment } from "./support/m-05-fixtures.ts";
import { ownerKey } from "../src/attachments/types.ts";
import { PROJECTION_IDENTITY } from "./support/lifecycle-projection-fixtures.ts";

const NOW = new Date("2026-11-11T12:00:00Z");

function draftFor(mode: SignatureMode, isWarehouseSigned: boolean) {
  const assignment = supplyAssignment();
  const releases = assignment.releases.map((release) => ({
    ...release,
    warehouse_signed: isWarehouseSigned,
  }));
  let sequence = 300;
  const draft = newReceiptDraft({
    assignment: { ...assignment, releases },
    releaseId: receiptId(8),
    ownerKey: ownerKey(PROJECTION_IDENTITY.owner),
    shiftId: receiptId(50),
    versions: { rules: "r", catalog: "c", signatureMode: mode },
    now: NOW,
    uuid: () => receiptId(sequence++),
  });
  return { ...draft, lines: draft.lines.map((line) => ({ ...line, quantity: line.expected })) };
}

void test("mode 2 (phone): the signature is always required, even if the warehouse signed", () => {
  for (const signed of [false, true]) {
    const draft = draftFor(2, signed);
    assert.equal(draft.needsSignature, true);
    assert.throws(() => {
      validateReceipt(draft);
    }, /signature_required/);
  }
});

void test("mode 1 (warehouse): no pad, the receipt only confirms quantities and sends no signature", () => {
  const draft = draftFor(1, true);
  assert.equal(draft.needsSignature, false);
  assert.doesNotThrow(() => {
    validateReceipt(draft);
  });
  assert.equal(receiptEvent(draft).payload.signature_upload_id, null);
});

void test("mode 1 (warehouse): a release made before the rule changed asks for the phone signature", () => {
  const draft = draftFor(1, false);
  assert.equal(draft.needsSignature, true);
  assert.throws(() => {
    validateReceipt(draft);
  }, /signature_required/);
});

void test("mode 0 (either): asks only while the delivery is not signed at the warehouse", () => {
  assert.equal(draftFor(0, false).needsSignature, true);
  const signed = draftFor(0, true);
  assert.equal(signed.needsSignature, false);
  assert.equal(receiptEvent(signed).payload.signature_upload_id, null);
});

void test("the mode comes from the downloaded rules and falls back to either", () => {
  const parameters = [
    { key: "other", value: 5 },
    { key: "delivery_signature_mode", value: 2 },
  ];
  assert.equal(signatureModeFromRules(parameters), 2);
  assert.equal(signatureModeFromRules([{ key: "delivery_signature_mode", value: "1" }]), 1);
  assert.equal(signatureModeFromRules([]), 0);
  assert.equal(signatureModeFromRules(undefined), 0);
});

void test("pending deliveries count released plans without an active receipt", () => {
  const assignment = supplyAssignment();
  const total = assignment.releases.length;
  assert.equal(countPendingDeliveries([assignment]), assignment.receipts.length ? 0 : total);
  const received = {
    ...assignment,
    receipts: assignment.releases.map((release) => ({
      id: release.id,
      event_id: release.id,
      source_event_id: release.id,
      release_id: release.id,
      signature_upload_id: null,
      voided: false,
      lines: [],
    })),
  };
  assert.equal(countPendingDeliveries([received]), 0);
  assert.equal(
    countPendingDeliveries([
      { ...received, receipts: received.receipts.map((row) => ({ ...row, voided: true })) },
    ]),
    total,
  );
});
