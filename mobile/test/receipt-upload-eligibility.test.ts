import assert from "node:assert/strict";
import { test } from "node:test";
import { attachmentHarness, EVIDENCE_ID } from "./support/attachment-fixtures.ts";
import { makeEnvelope } from "./support/factories.ts";

void test("a receipt signed at the warehouse (no phone signature) is claimed for upload", async (test) => {
  const h = await attachmentHarness(test);
  const receipt = makeEnvelope({
    type: "supplies.receive",
    payload: { signature_upload_id: null },
  });
  await h.outbox.enqueue(receipt);
  const claimed = await h.outbox.claimPending(50, await h.session.selection());
  assert.deepEqual(
    claimed.map((event) => event.envelope.id),
    [receipt.id],
  );
});

void test("a receipt that names a signature still waits until that file is verified", async (test) => {
  const h = await attachmentHarness(test);
  const receipt = makeEnvelope({
    type: "supplies.receive",
    payload: { signature_upload_id: EVIDENCE_ID },
  });
  await h.outbox.enqueue(receipt);
  assert.equal((await h.outbox.claimPending(50, await h.session.selection())).length, 0);
});
