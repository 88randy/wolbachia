import type { AreaCatalog } from "../area.ts";
export const ui = {
  "ui.actions.more": "Más acciones",
  "ui.actions.createFirst": "Crear el primer registro",
  "ui.actions.clearFilters": "Limpiar filtros",
  "ui.actions.details": "Ver detalles",
  "ui.actions.undo": "Deshacer",
  "ui.actions.review": "Revisar",
  "ui.actions.dismiss": "Cerrar aviso",
  "ui.states.refreshing": "Actualizando…",
  "ui.states.noData": "Todavía no hay registros. Crea el primero para empezar.",
  "ui.states.noResults": "No hay resultados con estos filtros. Límpialos para ver más registros.",
  "ui.states.loadError": "No pudimos cargar esta sección. Reintenta para actualizarla.",
  "ui.details.code": "Código",
  "ui.details.requestId": "Identificador de solicitud",
  "ui.preview.centerSouth": "Centro Sur",
  "ui.preview.feedback": "Estados y avisos",
  "ui.preview.undoHint":
    "Ya ocultaste este indicador. Puedes recuperarlo con Deshacer en el aviso.",
  "ui.preview.voided": "Anulación de muestra registrada",
  "ui.toast.label": "Avisos",
  "ui.toast.blocking": "Avisos que requieren atención",
} as const satisfies AreaCatalog<"ui">;
