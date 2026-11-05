import type { Locale } from "@wolbachia/i18n";

/** BCP 47 tag for `Intl`, as in `format-date-time.ts`. */
const INTL_LOCALE: Record<Locale, string> = { "es-MX": "es-MX", en: "en-US" };
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A moment as a date only, in the organization's time zone ("since 1 Jan 2026"). Returns the
 * original text when it is not a valid date.
 */
export function formatDate(iso: string, language: Locale, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(INTL_LOCALE[language], { dateStyle: "medium", timeZone }).format(
    date,
  );
}

/**
 * A calendar date (`YYYY-MM-DD`, what the API calls `effective_date`) as written. It names a day
 * in the organization's calendar, not an instant, so no time zone is applied: shifting it would
 * show another day.
 */
export function formatCalendarDate(isoDate: string, language: Locale): string {
  const match = CALENDAR_DATE.exec(isoDate);
  if (match === null) return isoDate;
  const day = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(INTL_LOCALE[language], {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(day);
}
