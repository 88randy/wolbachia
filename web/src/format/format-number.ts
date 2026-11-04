import type { Locale } from "@wolbachia/i18n";

const INTL_LOCALE: Record<Locale, string> = { "es-MX": "es-MX", en: "en-US" };
/** The API keeps three decimals (`VALUE_DECIMAL_PLACES`), so that is all there is to show. */
const MAX_FRACTION_DIGITS = 3;

/** A number in the interface language (thousands and decimal separators). */
export function formatNumber(value: number, language: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[language], {
    maximumFractionDigits: MAX_FRACTION_DIGITS,
  }).format(value);
}
