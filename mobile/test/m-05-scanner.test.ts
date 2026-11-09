import assert from "node:assert/strict";
import { test } from "node:test";
import { ReceiptScannerSession } from "../src/features/supply-receipt/scanner-session.ts";
import type { ReceiptScanContext } from "../src/features/supply-receipt/scanner-session.ts";
const ORIGINAL = { eventId: "original-receipt", sessionKey: "original-session" };

void test("P8 QR permission continuations cannot reopen after lock/background or a replacement session", async () => {
  const session = new ReceiptScannerSession();
  let current: ReceiptScanContext | null = ORIGINAL;
  let resolvePermission: (value: { granted: boolean }) => void = () => {
    throw new Error("Permission resolver unavailable");
  };
  const promise = new Promise<{ granted: boolean }>((resolve) => {
    resolvePermission = resolve;
  });
  const permission = { promise, resolve: resolvePermission };
  const input = {
    current: () => current,
    permission: null,
    requestPermission: () => permission.promise,
  };
  const pending = session.start(input);
  assert.equal((await session.start(input)).kind, "busy");
  current = null;
  session.observe(current);
  current = { eventId: "replacement-receipt", sessionKey: "replacement-session" };
  session.observe(current);
  current = ORIGINAL;
  permission.resolve({ granted: true });
  assert.equal((await pending).kind, "retry");
  const retry = await session.start({ ...input, permission: { granted: true } });
  assert.equal(retry.kind, "ready");
  assert.equal(session.consume(retry.ticket, current), ORIGINAL.eventId);
  assert.equal(session.consume(retry.ticket, current), null);
});

void test("P8 QR callbacks retain the original draft and consume only their own active lease", async () => {
  const session = new ReceiptScannerSession();
  let current = ORIGINAL;
  const input = {
    current: () => current,
    permission: { granted: true },
    requestPermission: () => Promise.resolve({ granted: true }),
  };
  const first = await session.start(input);
  assert.equal(first.kind, "ready");
  current = { eventId: "another-receipt", sessionKey: ORIGINAL.sessionKey };
  assert.equal(session.observe(current), true);
  const next = await session.start(input);
  if (next.kind !== "ready") throw new Error("Expected next scanner ticket.");
  assert.equal(session.consume(first.ticket, current), null);
  assert.equal(session.consume(next.ticket, current), "another-receipt");
  const denied = await session.start({
    ...input,
    permission: null,
    requestPermission: () => Promise.resolve({ granted: false }),
  });
  assert.equal(denied.kind, "denied");
});
