import type { Locale } from "@wolbachia/i18n";
import type { ChecklistItem } from "../shift-open/domain.ts";
export function catalogLabel(item: ChecklistItem, locale: Locale): string {
  return locale === "en" ? item.label_en || item.label_es : item.label_es;
}
