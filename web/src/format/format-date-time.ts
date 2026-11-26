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
  if (isLocalMidnight(date, timeZone))
    return new Intl.DateTimeFormat(INTL_LOCALE[language], { dateStyle: "medium", timeZone }).format(
      date,
    );
  return new Intl.DateTimeFormat(INTL_LOCALE[language], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

/** A calendar date stored as an instant sits exactly on local midnight: it is a day, not "12:00 a.m.". */
function isLocalMidnight(date: Date, timeZone: string): boolean {
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
  return time === "00:00:00";
}

/**
 * The last day of a validity that ends at a local midnight (a calendar end date ends at its
 * following midnight), written as a day; other moments keep their time.
 */
export function formatValidityEnd(iso: string, language: Locale, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || !isLocalMidnight(date, timeZone))
    return formatDateTime(iso, language, timeZone);
  return formatDateTime(new Date(date.getTime() - 1000).toISOString(), language, timeZone);
}
