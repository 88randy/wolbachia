import type { Schemas } from "@wolbachia/api-client";

import { NO_NAME } from "../../lookups/use-reference-names";
import type { CourierEntry } from "./allocation-query";

/** Names come from scoped directories; an id missing from them reads "—", never the id. */
export function lotLabel(lots: readonly Schemas["Lot"][] | undefined, lotId: string) {
  const lot = lots?.find((item) => item.id === lotId);
  return lot ? `${lot.code} · ${lot.supply_version.label}` : NO_NAME;
}

export function courierLabel(people: readonly CourierEntry[] | undefined, courierId: string) {
  return people?.find((person) => person.id === courierId)?.display_name ?? NO_NAME;
}
