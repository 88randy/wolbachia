import type { Schemas } from "@wolbachia/api-client";

const SHORT_ID_LENGTH = 8;
export function shortId(id: string) {
  return id.slice(0, SHORT_ID_LENGTH);
}

/** Names come from scoped directories; an id missing from them degrades to its short id. */
export function lotLabel(lots: readonly Schemas["Lot"][] | undefined, lotId: string) {
  const lot = lots?.find((item) => item.id === lotId);
  return lot ? `${lot.code} · ${lot.supply_version.label}` : shortId(lotId);
}

export function courierLabel(
  people: readonly Schemas["OperationalPersonnel"][] | undefined,
  courierId: string,
) {
  return people?.find((person) => person.id === courierId)?.display_name ?? shortId(courierId);
}

/** Today as YYYY-MM-DD in the organization's time zone. */
export function organizationToday(timeZone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}
