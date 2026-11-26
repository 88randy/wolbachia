import { useLanguage } from "../i18n/use-language";
import { formatDate } from "../format/format-date";
import { formatNumber } from "../format/format-number";

/**
 * The public portal has no session, so no organization time zone: dates use the zone of the
 * visitor. [ASSUMPTION] confirm whether the public API should send the organization zone.
 */
export function usePortalFormat() {
  const { language } = useLanguage();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    date: (iso: string) => formatDate(iso, language, zone),
    number: (value: number) => formatNumber(value, language),
  };
}
