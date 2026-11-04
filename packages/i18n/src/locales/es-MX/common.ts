/** Mexican Spanish messages of the `common` area. Source of the `common.*` key list. */
import type { AreaCatalog } from "../area.ts";

export const common = {
  // Common actions
  "common.actions.save": "Guardar",
  "common.actions.cancel": "Cancelar",
  "common.actions.retry": "Reintentar",
  "common.actions.close": "Cerrar",
  "common.actions.goHome": "Ir al inicio",
  "common.actions.void": "Anular",

  // Common fields
  "common.fields.voidReason": "Motivo de la anulación",
  "common.fields.otherSpecify": "Otro (especificar)",
} as const satisfies AreaCatalog<"common">;
