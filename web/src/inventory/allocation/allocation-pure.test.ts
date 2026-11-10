import { expect, test } from "vitest";
import { compareDelivery } from "./delivery-compare";
import { lineState, signatureState } from "./reconciliation-equation";
import { buildWriteOffDraft, writeOffBlockers } from "./write-off-draft";
import { biologicalLot, plainLot } from "./allocation-fixtures";

const LINE = {
  assignment_line_id: "l",
  plan_revision: 1,
  planned: "20",
  credited: "20",
  used: "16",
  returned: "1",
  shrinkage: "1",
  difference: "2",
  delivery_variance: null,
};

test("a missing receipt is pending, not zero; a zero difference is balanced; any other is flagged", () => {
  expect(lineState({ ...LINE, credited: null, difference: null })).toBe("pending");
  expect(lineState({ ...LINE, difference: "0.000000" })).toBe("balanced");
  expect(lineState({ ...LINE, difference: "-2" })).toBe("difference");
  expect(signatureState([{ credited: null }, { credited: "1" }])).toBe("pending");
  expect(signatureState([{ credited: "1" }])).toBe("verified");
  expect(signatureState([])).toBe("unknown");
});

test("delivery comparison is exact and never invents a suggestion", () => {
  const suggestion = {
    status: "assessed" as const,
    date: "2026-11-03",
    courier_id: "c",
    lines: [{ supply_version_id: "v1", mapping_id: "m", quantity: "30" }],
  };
  const lines = [{ key: "k", lotId: "l", lotCode: "L", supplyVersionId: "v1", quantity: "24" }];
  expect(compareDelivery(suggestion, lines)[0]).toMatchObject({ state: "short", gap: "6" });
  expect(compareDelivery({ ...suggestion, status: "unavailable" }, lines)[0]).toMatchObject({
    suggested: null,
    state: "unsuggested",
  });
});

const base = {
  reasonCode: "duplicate",
  reason: "",
  date: "2026-11-03",
  rpbiUploadId: "",
  ownerId: "u",
};
const context = { isOtherReason: false, minReasonLength: 10 };

test("a biological lot needs a verified RPBI; a plain lot does not", () => {
  const target = (lot = biologicalLot()) => ({
    kind: "lot" as const,
    lot,
    locationId: "loc",
    quantity: "3",
  });
  expect(writeOffBlockers({ ...base, target: target() }, context)).toContain(
    "allocation.writeOff.blockerRpbi",
  );
  expect(writeOffBlockers({ ...base, target: target(), rpbiUploadId: "up" }, context)).toEqual([]);
  expect(writeOffBlockers({ ...base, target: target(plainLot()) }, context)).toEqual([]);
});

test("the lot write-off carries the lot revision and the RPBI evidence", () => {
  const draft = buildWriteOffDraft({
    ...base,
    rpbiUploadId: "up",
    target: { kind: "lot", lot: biologicalLot(), locationId: "loc", quantity: "3" },
  });
  expect(draft?.body).toMatchObject({
    kind: "lot_write_off",
    expected_revision: biologicalLot().revision,
    evidence: [{ role: "rpbi", upload_id: "up" }],
  });
});
