import { readStored, STORAGE_KEYS, writeStored } from "../storage/safe-storage";
import { DEFAULT_COPIES, DEFAULT_LABEL_FORMAT, isLabelFormat, MAX_COPIES } from "./label-formats";
import type { LabelFormat } from "./label-formats";

export interface LabelPreferences {
  format: LabelFormat;
  copies: number;
}

const DEFAULTS: LabelPreferences = { format: DEFAULT_LABEL_FORMAT, copies: DEFAULT_COPIES };

function isCopies(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_COPIES;
}

/** The last choice of this browser; defaults when nothing valid is stored (or storage is blocked). */
export function readLabelPreferences(): LabelPreferences {
  const raw = readStored(STORAGE_KEYS.labelPrint);
  if (raw === null) return DEFAULTS;
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof LabelPreferences, unknown>>;
    return {
      format: isLabelFormat(value.format) ? value.format : DEFAULTS.format,
      copies: isCopies(value.copies) ? value.copies : DEFAULTS.copies,
    };
  } catch {
    return DEFAULTS;
  }
}

/** Remembers the choice; a blocked storage only means it is not remembered. */
export function saveLabelPreferences(preferences: LabelPreferences): void {
  writeStored(STORAGE_KEYS.labelPrint, JSON.stringify(preferences));
}
