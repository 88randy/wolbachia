/** What the UI needs to show a voided record. Compatible with `VoidInfo` of the data table (#29). */
export interface VoidInfo {
  reason: string;
  /** Already formatted for display (a name, never an id). */
  author: string;
  /** Already formatted in the organization's time zone; shown only when present. */
  when?: string;
}

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
