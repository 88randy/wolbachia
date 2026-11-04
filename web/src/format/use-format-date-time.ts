import { useCallback } from "react";
import { useLanguage } from "../i18n/use-language";
import { useMe } from "../session/use-me";
import { formatDateTime } from "./format-date-time";

const FALLBACK_TIME_ZONE = "UTC";

/**
 * `format(iso)` in the active organization's time zone and the interface language. The function
 * keeps its identity until the language or the zone changes, so columns built from it stay stable.
 */
export function useFormatDateTime(): (iso: string) => string {
  const { language } = useLanguage();
  const timeZone = useMe().organization?.timezone ?? FALLBACK_TIME_ZONE;
  return useCallback((iso) => formatDateTime(iso, language, timeZone), [language, timeZone]);
}
