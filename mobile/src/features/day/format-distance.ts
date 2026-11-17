import type { MessageKey } from "@wolbachia/i18n";

const KILOMETER_FROM_METERS = 1000;

/** Short distance as the courier reads it: whole meters under 1 km, whole kilometers from there. */
export function distanceMessage(
  meters: number,
  locale: string,
): { readonly key: MessageKey; readonly params: Readonly<Record<string, string>> } {
  if (meters < KILOMETER_FROM_METERS)
    return { key: "field.day.distance", params: { meters: String(Math.round(meters)) } };
  const km = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    Math.round(meters / KILOMETER_FROM_METERS),
  );
  return { key: "field.day.distanceKm", params: { km } };
}
