/** Mexican Spanish messages of the `live` area: today's shifts (W28). */
import type { AreaCatalog } from "../area.ts";

export const live = {
  "live.title": "Jornadas de hoy",
  "live.description": "Repartidores trabajando ahora: {count}. Se actualiza solo cada 30 segundos.",
  "live.note":
    "Mostramos los cuadrantes que cada repartidor trabaja hoy. Cuando termina su jornada, desaparece de aquí.",
  "live.listTitle": "En campo",
  "live.working": "Trabajando",
  "live.since": "Empezó a las {time}",
  "live.quadrants": "Cuadrantes: {list}",
  "live.focus": "Ver solo su zona",
  "live.showAll": "Ver todos",
  "live.details": "Ver jornada",
  "live.mapTitle": "Zonas de trabajo",
  "live.noMap": "Sin cuadrantes asignados para mostrar.",
  "live.empty": "Nadie está trabajando en este momento.",
  "live.position.recent": "Última posición: hace {minutes} min",
  "live.position.stale": "Sin posición nueva: hace {minutes} min",
  "live.position.none": "Todavía no recibimos su posición.",
  "live.position.staleLabel": "{name} · hace {minutes} min",
  "live.legend.recent": "Punto lleno: posición de los últimos {minutes} min.",
  "live.legend.stale": "Punto hueco y punteado: sin posición nueva en más de {minutes} min.",
  "live.position.error": "No pudimos cargar las posiciones. Se reintentará cada 30 segundos.",
  "live.track.error":
    "No pudimos cargar el recorrido de este repartidor. Se reintentará cada 2 minutos.",
} as const satisfies AreaCatalog<"live">;
