import type { FieldEventEnvelope } from "../../outbox/outbox-event.ts";
import { parseQr } from "../ovitrap-check/domain.ts";
import type { ReceiptDraft, ReceiptLine } from "./receipt-types.ts";

export class ReceiptError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = "ReceiptError";
  }
}
const SCALE = 1_000_000n;
/** Exact Decimal(20,6); no binary arithmetic or implicit packaging conversions. */
export function quantityValue(value: string): bigint | null {
  if (!/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/.test(value)) return null;
  const [whole = "", fraction = ""] = value.split(".");
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, "0"));
}
export function validQuantity(line: ReceiptLine): boolean {
  const actual = quantityValue(line.quantity);
  const expected = quantityValue(line.expected);
  return (
    actual !== null &&
    expected !== null &&
    actual <= expected &&
    (line.pieceId === null || actual === 0n || actual === SCALE)
  );
}
export function validateReceipt(
  draft: ReceiptDraft,
  needsSignature = draft.needsSignature !== false,
): void {
  if (!draft.lines.length || !draft.lines.every(validQuantity))
    throw new ReceiptError("quantity_invalid");
  const hasMismatch = draft.lines.some(
    (line) => quantityValue(line.quantity) !== quantityValue(line.expected),
  );
  if (hasMismatch && draft.discrepancy === null) throw new ReceiptError("discrepancy_required");
  validateDiscrepancy(draft);
  if (needsSignature && draft.signature === null) throw new ReceiptError("signature_required");
}
function validateDiscrepancy(draft: ReceiptDraft): void {
  if (draft.discrepancy === null) return;
  const explanation = draft.discrepancy.text.trim();
  if (draft.discrepancy.kind === "other" && !explanation) throw new ReceiptError("other_required");
  if (explanation.length > 180 || /[\p{Cc}\p{Cs}]/u.test(explanation))
    throw new ReceiptError("other_required");
  if (draft.discrepancy.kind === "damaged" && !draft.evidence.length)
    throw new ReceiptError("evidence_required");
}
/** A lot scan identifies a declared line, never a box-to-piece conversion. */
export function scanReceipt(draft: ReceiptDraft, value: string) {
  const parsed = parseQr(value, "lot");
  const matches = parsed
    ? draft.lines.filter((line) => line.lotId.toLowerCase() === parsed.id)
    : [];
  if (matches.length !== 1) return { draft, feedback: "invalid" as const };
  const line = matches[0];
  if (!line) return { draft, feedback: "invalid" as const };
  if (draft.scannedIds.includes(parsed?.id ?? "")) return { draft, feedback: "duplicate" as const };
  // A Piece is indivisible. A countable lot still needs an explicit quantity in its declared unit.
  const quantity = line.pieceId === null ? line.quantity : "1";
  return {
    draft: {
      ...draft,
      scannedIds: [...draft.scannedIds, line.lotId.toLowerCase()],
      lines: draft.lines.map((row) => (row.id === line.id ? { ...row, quantity } : row)),
      signature: null,
    },
    feedback: "added" as const,
  };
}
export function receiptEvent(draft: ReceiptDraft): FieldEventEnvelope {
  validateReceipt(draft);
  return {
    id: draft.eventId,
    type: "supplies.receive",
    schema_version: 1,
    device_time: draft.deviceTime,
    shift_id: draft.shiftId,
    gps: null,
    rules_version: draft.rulesVersion,
    catalog_version: draft.catalogVersion,
    manual_capture: draft.manualCapture,
    voids_event_id: null,
    payload: receiptPayload(draft),
  };
}
function receiptPayload(draft: ReceiptDraft): Record<string, unknown> {
  return {
    command_id: draft.eventId,
    assignment_id: draft.assignmentId,
    expected_revision: draft.expectedRevision,
    plan_revision: draft.planRevision,
    release_id: draft.releaseId,
    signature_upload_id: draft.signature?.id ?? null,
    actual_lines: draft.lines.map((line) => ({
      id: line.id,
      release_line_id: line.releaseLineId,
      quantity: line.quantity,
    })),
    discrepancies:
      draft.discrepancy === null
        ? []
        : [`${draft.discrepancy.kind}: ${draft.discrepancy.text.trim()}`],
  };
}
