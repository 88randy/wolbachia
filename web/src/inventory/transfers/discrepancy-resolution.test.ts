import { expect, test } from "vitest";
import type { Schemas } from "@wolbachia/api-client";
import { applyDiscrepancySignature, buildDiscrepancyClose } from "./discrepancy-resolution";
import type { DiscrepancyDraft } from "./discrepancy-resolution";

const line = {
  id: "case-line",
  kind: "missing" as const,
  line_id: "expected-line",
  quantity: "0.000001",
  observation: {},
};
const record = {
  revision: 0,
  receipt_event_id: "receipt",
  lines: [line],
  transfer: { events: [{ kind: "dispatch", id: "dispatch" }] },
} as Schemas["Discrepancy"];
const limits = { minLength: 10, maxLength: 1000 };
test("missing acknowledgement uses discrepancy line identity and exact full quantity without granting stock", () => {
  const body = buildDiscrepancyClose(
    record,
    {
      reason: "Confirmed missing material",
      evidenceId: "",
      outcomes: { "case-line": { kind: "ack_missing" } },
    },
    limits,
  );
  expect(body).toEqual({
    expected_revision: 0,
    reason: "Confirmed missing material",
    evidence_ids: [],
    resolution: { outcomes: [{ line_id: "case-line", kind: "ack_missing", quantity: "0.000001" }] },
  });
  expect(body).not.toHaveProperty("command_id");
});
test("recovery cannot claim a credit until a new verified signature and photo are selected", () => {
  const draft = {
    reason: "Receiving recovered material",
    evidenceId: "",
    outcomes: { "case-line": { kind: "recover_dest" as const, signatureId: "signature" } },
  };
  expect(buildDiscrepancyClose(record, draft, limits)).toBeNull();
  expect(
    buildDiscrepancyClose(record, { ...draft, evidenceId: "photo" }, limits)?.resolution.outcomes,
  ).toEqual([
    {
      line_id: "case-line",
      kind: "recover_dest",
      quantity: "0.000001",
      dispatch_event_id: "dispatch",
      receipt_event_id: "receipt",
      signature_upload_id: "signature",
    },
  ]);
});
test("extras cannot be acknowledged missing and require an actual signed correction reference", () => {
  const extra = { ...record, lines: [{ ...line, kind: "unidentified_extra" as const }] };
  const draft = {
    reason: "Reviewed unexpected material",
    evidenceId: "",
    outcomes: { "case-line": { kind: "ack_missing" as const } },
  };
  expect(buildDiscrepancyClose(extra, draft, limits)).toBeNull();
  expect(
    buildDiscrepancyClose(
      extra,
      {
        ...draft,
        outcomes: {
          "case-line": {
            kind: "reference_signed_correction",
            correctionTransferId: "actual-transfer",
            receiptId: "actual-receipt",
          },
        },
      },
      limits,
    )?.resolution.outcomes,
  ).toEqual([
    {
      line_id: "case-line",
      kind: "reference_signed_correction",
      quantity: "0.000001",
      correction_transfer_id: "actual-transfer",
      receipt_event_id: "actual-receipt",
    },
  ]);
});
test("every case line requires its own complete disposition and a valid authored reason", () => {
  const draft = { reason: "Too short", evidenceId: "", outcomes: {} };
  expect(buildDiscrepancyClose(record, draft, limits)).toBeNull();
  expect(
    buildDiscrepancyClose(record, { ...draft, reason: "Reviewed missing quantity" }, limits),
  ).toBeNull();
});

test("a late receiving signature cannot restore an outcome changed to missing acknowledgement", () => {
  const current: DiscrepancyDraft = {
    reason: "Current reason remains authored",
    evidenceId: "current-photo",
    outcomes: {
      "case-line": { kind: "ack_missing" },
      "other-line": { kind: "return_origin", signatureId: "other-signature" },
    },
  };
  const result = applyDiscrepancySignature(current, {
    lineId: "case-line",
    signatureId: "late-signature",
  });
  expect(result).toBe(current);
  expect(result.outcomes["case-line"]).toEqual({ kind: "ack_missing" });
  expect(result.reason).toBe("Current reason remains authored");
  expect(result.outcomes["other-line"]).toEqual({
    kind: "return_origin",
    signatureId: "other-signature",
  });
});
