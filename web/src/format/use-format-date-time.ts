import { useCallback } from "react";
import { useLanguage } from "../i18n/use-language";
import { useOrganizationTimeZone } from "./use-time-zone";
import { formatDateTime, formatValidityEnd } from "./format-date-time";

/**
 * `format(iso)` in the active organization's time zone and the interface language. The function
 * keeps its identity until the language or the zone changes, so columns built from it stay stable.
 */
export function useFormatDateTime(): (iso: string) => string {
  const { language } = useLanguage();
  const timeZone = useOrganizationTimeZone();
  return useCallback((iso) => formatDateTime(iso, language, timeZone), [language, timeZone]);
}

/** Like `useFormatDateTime`, for the end of a validity: a midnight end reads as its last day. */
export function useFormatValidityEnd(): (iso: string) => string {
  const { language } = useLanguage();
  const timeZone = useOrganizationTimeZone();
  return useCallback((iso) => formatValidityEnd(iso, language, timeZone), [language, timeZone]);
}
