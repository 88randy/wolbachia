/** Mexican Spanish messages of the `common` area. Source of the `common.*` key list. */
import type { AreaCatalog } from "../area.ts";

export const common = {
  // Common actions
  "common.actions.save": "Guardar",
  "common.actions.cancel": "Cancelar",
  "common.actions.retry": "Reintentar",
  "common.file.choose": "Elegir archivo",
  "common.file.none": "Ningún archivo seleccionado",
  "common.actions.close": "Cerrar",
  "common.actions.goHome": "Ir al inicio",
  "common.actions.void": "Anular",

  "common.actions.more": "Más opciones",
  "common.actions.morePages": "Más páginas",
  "common.actions.search": "Buscar",
  "common.actions.open": "Abrir",
  "common.actions.back": "Regresar",
  "common.actions.next": "Siguiente",
  "common.actions.previous": "Anterior",
  "common.actions.finish": "Listo",
  "common.actions.rowActions": "Acciones de la fila",
  "common.wizard.step": "Paso {current} de {total}",
  "common.pending.title": "Lo que tienes pendiente",
  "common.pending.empty": "No tienes pendientes. ¡Buen trabajo!",
  "common.table.searchPlaceholder": "Buscar…",
  "common.table.pageOf": "Página {page} de {pages}",
  "common.table.rows": "{count} registros",
  "common.table.empty": "Todavía no hay registros",
  "common.table.noResults": "Ningún registro coincide con los filtros",
  "common.table.clearFilters": "Quitar filtros",
  "common.table.loading": "Cargando registros",

  // Common fields
  "common.fields.voidReason": "Motivo de la anulación",
  "common.fields.otherSpecify": "Otro (especificar)",
} as const satisfies AreaCatalog<"common">;
