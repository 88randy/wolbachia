import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isPendingPhone,
  needsPhoneSignature,
  readSignatureMode,
} from "../src/features/supply-receipt/signature-need.ts";

const PENDING = { state: "pending_phone", channel: null } as const;
const WAREHOUSE = { state: "signed", channel: "warehouse_screen" } as const;

void test("mode 2 (phone only) always asks for the signature", () => {
  assert.equal(needsPhoneSignature(2, PENDING), true);
  assert.equal(needsPhoneSignature(2, WAREHOUSE), true);
  assert.equal(needsPhoneSignature(2, null), true);
});

void test("mode 1 (warehouse only) never shows the pad", () => {
  assert.equal(needsPhoneSignature(1, PENDING), false);
  assert.equal(needsPhoneSignature(1, WAREHOUSE), false);
});

void test("mode 0 (either) asks only while the delivery is not signed", () => {
  assert.equal(needsPhoneSignature(0, PENDING), true);
  assert.equal(needsPhoneSignature(0, null), true);
  assert.equal(needsPhoneSignature(0, WAREHOUSE), false);
});

void test("an unknown rule value falls back to either, and pending deliveries are recognised", () => {
  assert.equal(readSignatureMode(undefined), 0);
  assert.equal(readSignatureMode(7), 0);
  assert.equal(readSignatureMode(2), 2);
  assert.equal(isPendingPhone(PENDING), true);
  assert.equal(isPendingPhone(WAREHOUSE), false);
  assert.equal(isPendingPhone(null), false);
});
