import { LABEL_KIND_SPECS } from "./label-kinds";
import type { LabelKind } from "./label-kinds";

export type { LabelKind } from "./label-kinds";

/** One printable record. Every kind prints the same design: QR, the large human code, context lines. */
export interface LabelRecord {
  kind: LabelKind;
  /** The record id. It goes only into the QR of the kinds the phone matches by id; never printed. */
  id: string;
  /** The human code. The large text of the label. */
  code: string;
  /** One or two short context lines (a name, a date). Never ids. */
  lines: readonly string[];
}

/**
 * What the QR of a label encodes: `wbf:1:<kind>:<id or human code>` (see `LABEL_KIND_SPECS`).
 * This is the one place that decides it; the phone depends on it. No URLs, no personal data.
 */
export function qrContent(record: LabelRecord): string {
  const value = LABEL_KIND_SPECS[record.kind].qrBy === "id" ? record.id.toLowerCase() : record.code;
  return `wbf:1:${record.kind}:${value}`;
}
