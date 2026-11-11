import { useCallback } from "react";
import { useLanguage } from "../i18n/use-language";
import { useOrganizationTimeZone } from "./use-time-zone";
import { formatCalendarDate, formatDate } from "./format-date";
import { formatNumber } from "./format-number";

/** `format(iso)`: a moment as a date, in the organization's time zone and the interface language. */
export function useFormatDate(): (iso: string) => string {
  const { language } = useLanguage();
  const timeZone = useOrganizationTimeZone();
  return useCallback((iso) => formatDate(iso, language, timeZone), [language, timeZone]);
}

/** `format("2026-11-10")`: a calendar date of the organization, in the interface language. */
export function useFormatCalendarDate(): (isoDate: string) => string {
  const { language } = useLanguage();
  return useCallback((isoDate) => formatCalendarDate(isoDate, language), [language]);
}

/** `format(7.5)`: a number in the interface language. */
export function useFormatNumber(): (value: number) => string {
  const { language } = useLanguage();
  return useCallback((value) => formatNumber(value, language), [language]);
}
