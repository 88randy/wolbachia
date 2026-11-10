import { act, renderHook } from "@testing-library/react";
import { expect, test } from "vitest";
import { useReceptionDraft } from "./use-reception-draft";
import type { TransferMemory } from "./use-transfer-write";
import { transfer, TRANSFER_LINE_ID, TRANSFER_SIGNATURE_ID } from "./transfer-fixtures";

test("signature, photo and scanner callbacks from one render preserve all input in the same React batch", () => {
  const memory: TransferMemory = {};
  const record = transfer();
  const photo = "15200000-0000-4000-8000-000000000012";
  const { result } = renderHook(() => useReceptionDraft(memory));
  const capturedCallbacks = result.current;
  act(() => {
    capturedCallbacks.verifySignature(TRANSFER_SIGNATURE_ID);
    capturedCallbacks.verifyPhoto(TRANSFER_LINE_ID, photo);
    capturedCallbacks.recordScan(record, { code: TRANSFER_LINE_ID, quantity: "1" });
  });
  expect(result.current.draft).toMatchObject({
    signature: TRANSFER_SIGNATURE_ID,
    photos: { [TRANSFER_LINE_ID]: photo },
    scanned: [{ kind: "expected", line_id: TRANSFER_LINE_ID, quantity: "1" }],
  });
  expect(memory.reception).toEqual(result.current.draft);
});
