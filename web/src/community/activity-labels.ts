import type { Locale } from "@wolbachia/i18n";

interface Labeled {
  label_es: string;
  label_en: string;
}

/** The catalog label in the interface language, falling back to Spanish when English is empty. */
export function typeLabel(type: Labeled, language: Locale): string {
  return language === "en" && type.label_en !== "" ? type.label_en : type.label_es;
}
