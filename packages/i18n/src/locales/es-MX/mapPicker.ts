/** Mexican Spanish messages of the shared map point picker. Source of the `mapPicker.*` key list. */
import type { AreaCatalog } from "../area.ts";

export const mapPicker = {
  "mapPicker.hint": "Haz clic en el mapa para marcar el lugar. Arrastra el pin para ajustarlo.",
  "mapPicker.placed": "Lugar marcado en el mapa.",
  "mapPicker.empty": "Todavía no marcas el lugar.",
  "mapPicker.advanced": "Avanzado: ver coordenadas",
  "mapPicker.unavailable":
    "El mapa no se puede mostrar en este equipo. Pide ayuda a soporte técnico para marcar el lugar.",
} as const satisfies AreaCatalog<"mapPicker">;
