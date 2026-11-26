import type { Schemas } from "@wolbachia/api-client";
import type { Transfer } from "./transfer-query";
import { quantityText, quantityUnits } from "./transfer-quantities";
export interface ReceptionDraft {
  scanned: Schemas["ClosedScanRequest"][];
  photos: Record<string, string>;
  signature: string;
}
export function receivedUnits(draft: ReceptionDraft, lineId: string) {
  return draft.scanned.reduce(
    (sum, scan) =>
      sum +
      (scan.kind === "expected" && scan.line_id === lineId
        ? (quantityUnits(scan.quantity) ?? 0n)
        : 0n),
    0n,
  );
}
export function missingLines(transfer: Transfer, draft: ReceptionDraft) {
  return transfer.lines.flatMap((line) => {
    const difference = (quantityUnits(line.quantity) ?? 0n) - receivedUnits(draft, line.id);
    const photo = draft.photos[line.id];
    return difference > 0n
      ? [
          {
            line_id: line.id,
            quantity: quantityText(difference),
            evidence_ids: photo ? [photo] : [],
          },
        ]
      : [];
  });
}
/** Only manifest identities are resolved. Unknown literals remain uncredited observations. */
export function appendScan(
  transfer: Transfer,
  draft: ReceptionDraft,
  input: { code: string; quantity: string },
) {
  const code = input.code.trim();
  const units = quantityUnits(input.quantity);
  if (!code || units === null || units <= 0n) return { draft, result: "invalid" as const };
  const matches = transfer.lines.filter((line) =>
    [line.id, line.piece_id, line.lot_id].includes(code),
  );
  if (matches.length > 1) return { draft, result: "ambiguous" as const };
  const line = matches[0];
  if (!line) return appendUnknown(draft, input);
  return appendExpected(line, draft, { quantity: input.quantity, units });
}
function appendExpected(
  line: Schemas["TransferLine"],
  draft: ReceptionDraft,
  input: { quantity: string; units: bigint },
) {
  const { units } = input;
  const current = receivedUnits(draft, line.id);
  if (line.piece_id && current > 0n) return { draft, result: "duplicate" as const };
  if (
    (line.piece_id && units !== SCALE_UNIT) ||
    current + units > (quantityUnits(line.quantity) ?? 0n)
  )
    return { draft, result: "invalid" as const };
  const scan: Schemas["ExpectedScanRequest"] = {
    kind: "expected",
    scan_id: crypto.randomUUID(),
    line_id: line.id,
    quantity: input.quantity,
  };
  return { draft: { ...draft, scanned: [...draft.scanned, scan] }, result: "accepted" as const };
}
const SCALE_UNIT = 1_000_000n;
function appendUnknown(draft: ReceptionDraft, input: { code: string; quantity: string }) {
  const scan: Schemas["UnidentifiedExtraRequest"] = {
    kind: "unidentified_extra",
    scan_id: crypto.randomUUID(),
    unidentified_code: input.code.trim(),
    quantity: input.quantity,
  };
  return { draft: { ...draft, scanned: [...draft.scanned, scan] }, result: "extra" as const };
}
export function receptionBody(
  transfer: Transfer,
  draft: ReceptionDraft,
): Schemas["ReceiveTransferRequest"] {
  return {
    command_id: crypto.randomUUID(),
    expected_revision: transfer.revision,
    signature_upload_id: draft.signature,
    scanned: draft.scanned,
    missing: missingLines(transfer, draft),
    evidence_ids: [...new Set(Object.values(draft.photos).filter(Boolean))],
  };
}

/** Everything arrived as expected: one scan per line with its full quantity (the starting point). */
export function prefilledDraft(transfer: Transfer): ReceptionDraft {
  const scanned = transfer.lines.map<Schemas["ClosedScanRequest"]>((line) => ({
    kind: "expected",
    scan_id: crypto.randomUUID(),
    line_id: line.id,
    quantity: line.quantity,
  }));
  return { scanned, photos: {}, signature: "" };
}

/** The person says how much of one line really arrived; its earlier scans are replaced by it. */
export function setLineReceived(
  transfer: Transfer,
  draft: ReceptionDraft,
  input: { lineId: string; quantity: string },
) {
  const line = transfer.lines.find((item) => item.id === input.lineId);
  const units = quantityUnits(input.quantity.trim() === "" ? "0" : input.quantity.trim());
  const expected = line ? quantityUnits(line.quantity) : null;
  if (!line || units === null || expected === null || units > expected)
    return { draft, result: "invalid" as const };
  const kept = draft.scanned.filter(
    (scan) => !(scan.kind === "expected" && scan.line_id === line.id),
  );
  if (units === 0n) return { draft: { ...draft, scanned: kept }, result: "accepted" as const };
  const scan: Schemas["ExpectedScanRequest"] = {
    kind: "expected",
    scan_id: crypto.randomUUID(),
    line_id: line.id,
    quantity: quantityText(units),
  };
  return { draft: { ...draft, scanned: [...kept, scan] }, result: "accepted" as const };
}
