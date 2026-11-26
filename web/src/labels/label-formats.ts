import type { MessageKey } from "@wolbachia/i18n";

/**
 * Printable formats. The physical sizes live in `labels.module.css` (`data-format`), because
 * `@page` sizes cannot come from code. [ASSUMPTION] the client's printers are unknown: 50 x 25 mm
 * and 62 x 29 mm are common thermal rolls, and the letter sheet is an Avery 5160-like layout
 * (3 x 10 labels of 66.7 x 25.4 mm). Confirm with the real printer and sheet before ordering stock.
 */
export const LABEL_FORMATS = ["thermal50x25", "thermal62x29", "letter3x10"] as const;
export type LabelFormat = (typeof LABEL_FORMATS)[number];

export const DEFAULT_LABEL_FORMAT: LabelFormat = "thermal50x25";

export interface LabelFormatSpec {
  id: LabelFormat;
  labelKey: MessageKey;
  /** Labels that fit on one printed page: a roll prints one per page, the sheet prints a grid. */
  perPage: number;
}

export const LABEL_FORMAT_SPECS: Record<LabelFormat, LabelFormatSpec> = {
  thermal50x25: { id: "thermal50x25", labelKey: "labels.format.thermal50x25", perPage: 1 },
  thermal62x29: { id: "thermal62x29", labelKey: "labels.format.thermal62x29", perPage: 1 },
  letter3x10: { id: "letter3x10", labelKey: "labels.format.letter3x10", perPage: 30 },
};

export const DEFAULT_COPIES = 1;
export const MAX_COPIES = 50;
/** One print job never goes beyond this many labels (a roll of that size is already a long job). */
export const MAX_LABELS = 300;

export function isLabelFormat(value: unknown): value is LabelFormat {
  return typeof value === "string" && (LABEL_FORMATS as readonly string[]).includes(value);
}
