import type { VoidInfo } from "../data-table/table-types";

export type { VoidInfo };

/** The void fields every voidable record carries in the API (`VoidableMixin`). */
export interface VoidFields {
  voided_at?: string | null;
  voided_by?: string | null;
  void_reason_code?: string;
  void_reason?: string;
}

interface VoidDisplayOptions {
  formatWhen?: (isoInstant: string) => string;
  reasonLabel?: (code: string) => string;
}

function voidReasonOf(
  record: VoidFields,
  reasonLabel?: (code: string) => string,
): Pick<VoidInfo, "reason" | "note"> {
  const code = record.void_reason_code ?? "other";
  const text = record.void_reason ?? "";
  if (code === "" || code === "other") return { reason: text };
  return {
    reason: reasonLabel?.(code) ?? code,
    ...(text === "" ? {} : { note: text }),
  };
}

/**
 * `null` while the record is not voided. Callers resolve the author and optionally format the date.
 * Catalog reasons use `reasonLabel` (or the raw code), with optional free text as a separate note.
 * Other and records without a code keep their original free text.
 */
export function voidInfoOf(
  record: VoidFields,
  authorLabel: (userId: string | null) => string,
  { formatWhen, reasonLabel }: VoidDisplayOptions = {},
): VoidInfo | null {
  const { voided_at: voidedAt, voided_by: voidedBy } = record;
  if (voidedAt === undefined || voidedAt === null) return null;
  const info: VoidInfo = {
    ...voidReasonOf(record, reasonLabel),
    author: authorLabel(voidedBy ?? null),
  };
  return formatWhen === undefined ? info : { ...info, when: formatWhen(voidedAt) };
}
