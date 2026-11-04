/** English messages of the `phones` area: exactly the keys of `../es-MX/phones.ts`. */
import type { phones as source } from "../es-MX/phones.ts";

export const phones: Record<keyof typeof source, string> = {
  "phones.page.title": "Phones",
  "phones.page.hint": "Phones registered in your organization and the app version they run.",
  "phones.table.caption": "Registered phones",

  "phones.column.person": "Person",
  "phones.column.phone": "Phone",
  "phones.column.version": "Version",
  "phones.column.lastSeen": "Last seen",
  "phones.column.status": "Status",

  "phones.filter.status": "Status",

  "phones.status.active": "Active",
  "phones.status.revoked": "Revoked",

  "phones.cell.noPerson": "No user",
  "phones.cell.neverSeen": "Never",
};
