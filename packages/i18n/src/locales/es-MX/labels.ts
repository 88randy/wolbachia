/** Mexican Spanish messages of the shared label printing (QR labels). Source of the `labels.*` key list. */
import type { AreaCatalog } from "../area.ts";

export const labels = {
  "labels.action.printOne": "Imprimir etiqueta",
  "labels.dialog.title": "Imprimir etiquetas",
  "labels.dialog.count": "Etiquetas distintas: {count}",
  "labels.dialog.total": "Etiquetas en total: {count}",
  "labels.dialog.tooMany": "Son demasiadas etiquetas. Se imprimen las primeras {count}.",
  "labels.format.field": "Tamaño de etiqueta",
  "labels.format.hint":
    "Si no sabes cuál elegir: 50 × 25 mm para impresora de rollo, o la hoja carta si usas hojas de etiquetas adhesivas.",
  "labels.format.thermal50x25": "Rollo 50 × 25 mm",
  "labels.format.thermal62x29": "Rollo 62 × 29 mm",
  "labels.format.letter3x10": "Hoja carta, 30 etiquetas (66.7 × 25.4 mm)",
  "labels.copies.field": "Copias de cada etiqueta",
  "labels.copies.hint": "De 1 a {max}.",
  "labels.preview.title": "Vista previa",
  "labels.preview.hint": "Se ve a tamaño real, como saldrá en el papel.",
  "labels.preview.empty": "Marca registros en la lista y aquí verás sus etiquetas.",
  "labels.qr.alt": "Código QR de {code}",
  "labels.print.button": "Imprimir",
  "labels.print.noRecords": "No hay registros para imprimir.",
  "labels.print.help":
    "Se abre la ventana de impresión de tu equipo. Elige tu impresora y, si te lo pide, pon los márgenes en «Ninguno» y la escala en 100 %.",
  "labels.line.expires": "Caduca {date}",
  "labels.line.createdOn": "Registrada {date}",
  "labels.line.plate": "Placas {plate}",
  "labels.line.point": "Punto {code}",
} as const satisfies AreaCatalog<"labels">;
