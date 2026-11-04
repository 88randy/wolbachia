/** Mexican Spanish messages of the `table` area (web DataTable and FilterBar, #29). Source of the `table.*` key list. */
import type { AreaCatalog } from "../area.ts";

export const table = {
  // Sorting. `{column}` is the already translated header of the column.
  "table.sort.ascending": "Ordenado por {column}, de menor a mayor",
  "table.sort.descending": "Ordenado por {column}, de mayor a menor",

  // Result count and loading, announced to screen readers
  "table.status.range": "Mostrando {from} a {to} de {total}",
  "table.status.rangeCursor": "Resultados en esta página: {count}",
  "table.status.loading": "Cargando resultados",

  // Paging
  "table.pager.label": "Paginación",
  "table.pager.previous": "Anterior",
  "table.pager.next": "Siguiente",
  "table.pager.position": "Página {page} de {pages}",
  "table.pager.first": "Ir a la primera página",

  // Filter bar
  "table.filters.label": "Filtros",
  "table.filters.active": "Filtros activos",
  "table.filters.all": "Todos",
  "table.filters.apply": "Aplicar",
  "table.filters.clear": "Limpiar filtros",
  "table.filters.remove": "Quitar filtro {filter}: {value}",
  "table.filters.includeVoided": "Incluir anulados",
  "table.filters.ignoredTitle": "Ignoramos parte de la dirección",
  "table.filters.ignoredBody":
    "Estos parámetros no son válidos para esta lista y no se aplicaron: {names}.",
  "table.filters.ignoredMore": "y {count} más",
  "table.filters.ignoredDismiss": "Quitar de la dirección",

  // Empty state
  "table.empty.title": "Aquí todavía no hay registros",
  "table.empty.filteredTitle": "Sin resultados con estos filtros",
  "table.empty.filteredBody": "Prueba con otros filtros o límpialos para ver todo.",

  // Row selection
  "table.selection.all": "Seleccionar todas las filas de esta página",
  "table.selection.row": "Seleccionar {row}",
  "table.selection.count": "Seleccionados: {count}",
  "table.selection.clear": "Quitar selección",

  // Voided rows
  "table.voided.badge": "Anulado",
  "table.voided.reason": "Motivo: {reason}",
  "table.voided.author": "Anuló: {author}",
  "table.voided.when": "Fecha: {when}",

  // Export (the file is built by the backend)
  "table.export.button": "Exportar",
  "table.export.pending": "Preparando la exportación",
  "table.export.done": "La exportación se descargó.",
} as const satisfies AreaCatalog<"table">;
