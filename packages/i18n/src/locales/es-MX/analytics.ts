import type { AreaCatalog } from "../area.ts";
export const analytics = {
  "analytics.kpi.label": "Indicadores de operación",
  "analytics.delta.up": "Subió",
  "analytics.delta.down": "Bajó",
  "analytics.delta.unchanged": "Sin cambio",
  "analytics.delta.comparison": "respecto al periodo anterior",
  "analytics.chart.showTable": "Mostrar tabla de datos",
  "analytics.chart.hideTable": "Ocultar tabla de datos",
  "analytics.chart.period": "Periodo",
  "analytics.chart.position": "Explorar un periodo de la gráfica",
  "analytics.chart.noData": "Todavía no hay datos para esta gráfica.",
} as const satisfies AreaCatalog<"analytics">;
