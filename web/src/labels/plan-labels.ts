import { MAX_COPIES, MAX_LABELS } from "./label-formats";
import type { LabelRecord } from "./label-record";

/** The copies field as a whole number between 1 and the maximum; anything else counts as 1. */
export function parseCopies(text: string): number {
  const value = Number.parseInt(text, 10);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(value, MAX_COPIES);
}

export interface LabelPlan {
  /** Every label to print, in order, copies together. */
  labels: readonly LabelRecord[];
  /** The records had more labels than one job allows, so the list was cut. */
  isTruncated: boolean;
}

/** Repeats each record `copies` times (copies of one record stay together), up to `MAX_LABELS`. */
export function planLabels(records: readonly LabelRecord[], copies: number): LabelPlan {
  const all = records.flatMap((record) => Array.from({ length: copies }, () => record));
  return { labels: all.slice(0, MAX_LABELS), isTruncated: all.length > MAX_LABELS };
}

/** Splits labels into printed pages of `perPage`. */
export function paginate(
  labels: readonly LabelRecord[],
  perPage: number,
): readonly (readonly LabelRecord[])[] {
  const pages: LabelRecord[][] = [];
  for (let start = 0; start < labels.length; start += perPage) {
    pages.push(labels.slice(start, start + perPage));
  }
  return pages;
}
