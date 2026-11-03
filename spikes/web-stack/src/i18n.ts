import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Stand-in for packages/i18n catalogs. Placeholders are {param}, no ICU.
const resources = {
  "es-MX": {
    translation: {
      "incidents.title": "Incidencias",
      "incidents.results": "{count} resultados, página {page} de {pages}",
      "incidents.filter.status": "Estado",
      "incidents.filter.all": "Todos",
      "incidents.filter.clear": "Limpiar filtros",
      "incidents.col.code": "Código",
      "incidents.col.status": "Estado",
      "incidents.col.created_at": "Creada",
      "incidents.prev": "Anterior",
      "incidents.next": "Siguiente",
      "status.open": "Abierta",
      "status.closed": "Cerrada",
      "chart.title": "Índice semanal",
      "chart.week": "Semana",
      "chart.value": "Positivas",
      "chart.denominator": "Total",
      "count.label": "Conteo de huevos",
      "count.save": "Guardar",
      "error.not_integer": "Escribe un entero mayor o igual a 0",
    },
  },
  en: {
    translation: {
      "incidents.title": "Incidents",
      "incidents.results": "{count} results, page {page} of {pages}",
      "incidents.filter.status": "Status",
      "incidents.filter.all": "All",
      "incidents.filter.clear": "Clear filters",
      "incidents.col.code": "Code",
      "incidents.col.status": "Status",
      "incidents.col.created_at": "Created",
      "incidents.prev": "Previous",
      "incidents.next": "Next",
      "status.open": "Open",
      "status.closed": "Closed",
      "chart.title": "Weekly index",
      "chart.week": "Week",
      "chart.value": "Positive",
      "chart.denominator": "Total",
      "count.label": "Egg count",
      "count.save": "Save",
      "error.not_integer": "Enter an integer, 0 or more",
    },
  },
};

export async function setupI18n(lng: "es-MX" | "en" = "es-MX") {
  await i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: "es-MX",
    interpolation: { prefix: "{", suffix: "}", escapeValue: false }, // React already escapes
  });
  return i18n;
}
export default i18n;
