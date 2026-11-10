import type { AreaCatalog } from "../area.ts";
export const permitDocument = {
  "permitDocument.file.label": "Documento oficial del permiso",
  "permitDocument.file.hint":
    "Selecciona un PDF, JPEG o PNG de hasta {max}. Se muestra el nombre y el tamaño antes de cargarlo.",
  "permitDocument.file.selected": "Archivo seleccionado: {name} ({size})",
  "permitDocument.file.upload": "Cargar documento",
  "permitDocument.file.retry": "Reintentar carga",
  "permitDocument.file.invalidType": "Solo se aceptan archivos PDF, JPEG o PNG.",
  "permitDocument.file.tooLarge": "El archivo supera el límite de {max}.",
  "permitDocument.file.empty": "El archivo está vacío.",
  "permitDocument.download.action": "Descargar documento oficial",
  "permitDocument.download.failed": "No pudimos descargar el documento. Inténtalo de nuevo.",
} as const satisfies AreaCatalog<"permitDocument">;
