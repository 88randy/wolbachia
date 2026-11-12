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
  /** Big text to show when `code` looks like an id (for example the point of an ovitrap). */
  fallbackCode?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids are never shown to people. */
export function looksLikeId(text: string): boolean {
  return UUID_PATTERN.test(text.trim());
}

/** What a person reads on a label or in a list: the big text and the context lines, never an id. */
export function visibleText(record: LabelRecord): { heading: string; lines: readonly string[] } {
  if (!looksLikeId(record.code)) return { heading: record.code, lines: record.lines };
  const heading = record.fallbackCode ?? record.lines[0] ?? "";
  return { heading, lines: record.fallbackCode === undefined ? record.lines.slice(1) : [] };
}

/**
 * What the QR of a label encodes: `wbf:1:<kind>:<id or human code>` (see `LABEL_KIND_SPECS`).
 * This is the one place that decides it; the phone depends on it. No URLs, no personal data.
 */
export function qrContent(record: LabelRecord): string {
  const value = LABEL_KIND_SPECS[record.kind].qrBy === "id" ? record.id.toLowerCase() : record.code;
  return `wbf:1:${record.kind}:${value}`;
}
