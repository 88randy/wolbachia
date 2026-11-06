import type { Locale } from "@wolbachia/i18n";
/** Preserve every Decimal digit, including the sign; Number would round stock quantities. */
export function formatInventoryQuantity(value: string, locale: Locale) {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) return value;
  const [integer = "0", fraction] = value.split(".");
  const formatter = new Intl.NumberFormat(locale);
  const grouped = formatter.format(BigInt(integer));
  if (!fraction) return grouped;
  const separator =
    formatter.formatToParts(1.1).find((part) => part.type === "decimal")?.value ?? ".";
  const sign = integer === "-0" ? "-" : "";
  return `${sign}${grouped}${separator}${fraction}`;
}
