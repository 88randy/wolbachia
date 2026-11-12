/**
 * One printable record. QR convention (shared with the camera scanner): the QR encodes ONLY the
 * record's human code, exactly as the screens show it. No URLs, no ids, no personal data.
 */
export interface LabelRecord {
  /** The human code. It is the whole QR content and the large text of the label. */
  code: string;
  /** One or two short context lines (a name, a date). Never ids. */
  lines: readonly string[];
}

/** What the QR of a label encodes. */
export function qrContent(record: LabelRecord): string {
  return record.code;
}
