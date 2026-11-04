import type { Locale } from "@wolbachia/i18n";

/** BCP 47 tag for `Intl`: es-MX formats (day first, 24 h) and English as written in the US. */
const INTL_LOCALE: Record<Locale, string> = { "es-MX": "es-MX", en: "en-US" };

/**
 * A moment as the organization reads it: date and time in the organization's time zone (the API
 * sends UTC, docs/api-conventions.md "Time") and in the language of the interface. Returns the
 * original text when it is not a valid date, so a bad value is visible instead of "Invalid Date".
 */
export function formatDateTime(iso: string, language: Locale, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(INTL_LOCALE[language], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}
