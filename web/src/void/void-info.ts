import type { VoidInfo } from "../data-table/table-types";

export type { VoidInfo };

/** The void fields every voidable record carries in the API (`VoidableMixin`). */
export interface VoidFields {
  voided_at?: string | null;
  voided_by?: string | null;
  void_reason?: string;
}

/**
 * `null` while the record is not voided. `authorLabel` turns the author's id into a name (the API
 * only sends the id today); `formatWhen` formats `voided_at` (omit it to not show the date).
 */
export function voidInfoOf(
  record: VoidFields,
  authorLabel: (userId: string | null) => string,
  formatWhen?: (isoInstant: string) => string,
): VoidInfo | null {
  const { voided_at: voidedAt, voided_by: voidedBy, void_reason: reason } = record;
  if (voidedAt === undefined || voidedAt === null) return null;
  const info: VoidInfo = { reason: reason ?? "", author: authorLabel(voidedBy ?? null) };
  return formatWhen === undefined ? info : { ...info, when: formatWhen(voidedAt) };
}
