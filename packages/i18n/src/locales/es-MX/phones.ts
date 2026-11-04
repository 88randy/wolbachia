/** Mexican Spanish messages of the `phones` area (W67, registered phones). Source of the `phones.*` key list. */
import type { AreaCatalog } from "../area.ts";

export const phones = {
  "phones.page.title": "Teléfonos",
  "phones.page.hint": "Teléfonos registrados en tu organización y la versión de la app que usan.",
  "phones.table.caption": "Teléfonos registrados",

  "phones.column.person": "Persona",
  "phones.column.phone": "Teléfono",
  "phones.column.version": "Versión",
  "phones.column.lastSeen": "Última conexión",
  "phones.column.status": "Estado",

  "phones.filter.status": "Estado",

  "phones.status.active": "Activo",
  "phones.status.revoked": "Revocado",

  "phones.cell.noPerson": "Sin usuario",
  "phones.cell.neverSeen": "Nunca",
} as const satisfies AreaCatalog<"phones">;
