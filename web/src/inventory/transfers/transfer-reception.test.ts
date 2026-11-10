import { expect, test } from "vitest";
import { appendScan, missingLines, receivedUnits } from "./transfer-reception";
import type { ReceptionDraft } from "./transfer-reception";
import {
  transfer,
  transferLine,
  TRANSFER_LINE_ID,
  TRANSFER_PIECE_ID,
  TRANSFER_SIGNATURE_ID,
} from "./transfer-fixtures";
const emptyDraft = (): ReceptionDraft => ({ scanned: [], photos: {}, signature: "" });

test.each([
  { expected: "1", scanned: ["0.1", "0.2"], missing: "0.7", units: 300000n },
  {
    expected: "99999999999999.999999",
    scanned: ["99999999999999.999998"],
    missing: "0.000001",
    units: 99999999999999999998n,
  },
])(
  "missing $missing is calculated exactly and retains only its line's photo",
  ({ expected, scanned, missing, units }) => {
    const record = transfer({ lines: [transferLine({ quantity: expected })] });
    let draft = emptyDraft();
    for (const quantity of scanned)
      draft = appendScan(record, draft, { code: TRANSFER_LINE_ID, quantity }).draft;
    expect(receivedUnits(draft, TRANSFER_LINE_ID)).toBe(units);
    expect(missingLines(record, draft)).toEqual([
      { line_id: TRANSFER_LINE_ID, quantity: missing, evidence_ids: [] },
    ]);
    draft = {
      ...draft,
      photos: { [TRANSFER_LINE_ID]: TRANSFER_SIGNATURE_ID, unrelated: "unrelated-photo" },
    };
    expect(missingLines(record, draft)).toEqual([
      { line_id: TRANSFER_LINE_ID, quantity: missing, evidence_ids: [TRANSFER_SIGNATURE_ID] },
    ]);
  },
);

test("scanning an indivisible piece twice announces duplicate without crediting a second piece", () => {
  const record = transfer({ lines: [transferLine({ piece_id: TRANSFER_PIECE_ID })] });
  const first = appendScan(record, emptyDraft(), { code: TRANSFER_PIECE_ID, quantity: "1" });
  expect(first.result).toBe("accepted");
  const duplicate = appendScan(record, first.draft, { code: TRANSFER_PIECE_ID, quantity: "1" });
  expect(duplicate.result).toBe("duplicate");
  expect(duplicate.draft).toBe(first.draft);
  expect(missingLines(record, duplicate.draft)).toEqual([]);
});

test("unknown scanned literals remain unidentified extras and never credit expected stock", () => {
  const record = transfer();
  const observed = appendScan(record, emptyDraft(), {
    code: "  foreign-physical-label  ",
    quantity: "1",
  });
  expect(observed.result).toBe("extra");
  expect(observed.draft.scanned).toHaveLength(1);
  expect(observed.draft.scanned[0]?.scan_id).toMatch(/^[\da-f-]{36}$/i);
  expect(observed.draft.scanned).toMatchObject([
    {
      kind: "unidentified_extra",
      unidentified_code: "foreign-physical-label",
      quantity: "1",
    },
  ]);
  expect(missingLines(record, observed.draft)).toEqual([
    { line_id: TRANSFER_LINE_ID, quantity: "1", evidence_ids: [] },
  ]);
});

test("a lot matching multiple manifest lines is ambiguous and requires an exact line or piece", () => {
  const first = transferLine({ piece_id: TRANSFER_PIECE_ID });
  const record = transfer({
    lines: [first, transferLine({ id: "another-line", piece_id: "another-piece" })],
  });
  const draft = emptyDraft();
  expect(appendScan(record, draft, { code: first.lot_id, quantity: "1" })).toEqual({
    draft,
    result: "ambiguous",
  });
});

test.each([
  { piece: null, quantity: "1.000001" },
  { piece: TRANSFER_PIECE_ID, quantity: "0.5" },
  { piece: null, quantity: "0.0000001" },
  { piece: null, quantity: "0" },
])(
  "invalid or excess quantity $quantity cannot alter manifest reception",
  ({ piece, quantity }) => {
    const record = transfer({ lines: [transferLine({ piece_id: piece })] });
    const draft = emptyDraft();
    expect(appendScan(record, draft, { code: TRANSFER_LINE_ID, quantity })).toEqual({
      draft,
      result: "invalid",
    });
  },
);
