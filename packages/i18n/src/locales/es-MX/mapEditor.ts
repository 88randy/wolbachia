/** Mexican Spanish messages of the `mapEditor` area (W23 map editor). Source of the `mapEditor.*` key list. */
import type { AreaCatalog } from "../area.ts";

export const mapEditor = {
  "mapEditor.title": "Editor de mapa",
  "mapEditor.description":
    "Dibuja cuadrantes, coloca puntos de muestreo y de liberación, y corrige su lugar en el mapa.",
  "mapEditor.panel": "Herramientas del editor",
  "mapEditor.map.label": "Mapa del editor",
  "mapEditor.map.unavailable":
    "El mapa no se puede mostrar en este equipo. Puedes editar las coordenadas desde la ficha de cada cuadrante.",

  "mapEditor.tool.group": "Herramientas",
  "mapEditor.tool.quadrant": "Dibujar cuadrante",
  "mapEditor.tool.quadrantHint": "Haz clic en cada esquina",
  "mapEditor.tool.sampling": "Colocar punto de muestreo",
  "mapEditor.tool.samplingHint": "Dentro de una manzana",
  "mapEditor.tool.release": "Colocar punto de liberación",
  "mapEditor.tool.releaseHint": "Dentro de un cuadrante",
  "mapEditor.tool.move": "Mover o corregir",
  "mapEditor.tool.moveHint": "Arrastra esquinas y puntos",

  "mapEditor.field.quadrant": "Cuadrante",
  "mapEditor.field.quadrantPlaceholder": "Elige un cuadrante",
  "mapEditor.field.name": "Nombre del cuadrante",
  "mapEditor.field.center": "Centro",
  "mapEditor.field.centerPlaceholder": "Elige el centro",
  "mapEditor.field.pointName": "Nombre del punto",

  "mapEditor.fact.area": "Área",
  "mapEditor.fact.areaValue": "{area} km²",
  "mapEditor.fact.points": "Puntos de muestreo",
  "mapEditor.fact.blocks": "Manzanas",

  "mapEditor.browse.help":
    "Elige una herramienta. Para ver los datos de un cuadrante, haz clic en él en el mapa.",
  "mapEditor.browse.open": "Abrir la ficha del cuadrante",

  "mapEditor.quadrant.step1": "Haz clic en el mapa en cada esquina del cuadrante.",
  "mapEditor.quadrant.step2":
    "Para terminar, haz clic otra vez en la primera o en la última esquina.",
  "mapEditor.quadrant.corners": "Esquinas puestas: {count}",
  "mapEditor.quadrant.closed": "Cuadrante cerrado. Ponle nombre y guárdalo.",
  "mapEditor.quadrant.adjust":
    "Puedes arrastrar las esquinas para ajustar la forma antes de guardar.",

  "mapEditor.point.samplingStep": "Haz clic dentro de una manzana para colocar el punto.",
  "mapEditor.point.releaseStep": "Haz clic dentro de un cuadrante para colocar el punto.",
  "mapEditor.point.inBlock": "Manzana {block} del cuadrante {quadrant}.",
  "mapEditor.point.inQuadrant": "Cuadrante {quadrant}.",
  "mapEditor.point.needBlock":
    "El punto debe quedar dentro de una manzana. Haz clic en otro lugar.",
  "mapEditor.point.needQuadrant":
    "El punto debe quedar dentro de un cuadrante. Haz clic en otro lugar.",
  "mapEditor.point.outsidePermit":
    "Este lugar queda fuera de la zona del permiso. No se podrá liberar aquí hasta que el permiso lo incluya.",
  "mapEditor.point.again": "Si te equivocaste, haz clic en otro lugar del mapa.",

  "mapEditor.move.pick": "Elige en el mapa o en la lista el cuadrante que quieres corregir.",
  "mapEditor.move.help":
    "Arrastra una esquina para cambiar la forma. Para mover un punto, haz clic en él y luego arrástralo. Haz clic en el punto medio de una línea para agregar una esquina.",
  "mapEditor.move.changes": "Cambios sin guardar: {count}",
  "mapEditor.move.noChanges": "Todavía no hay cambios.",
  "mapEditor.move.outside":
    "Puntos que quedan fuera de la nueva forma: {count}. Decide qué pasa con cada uno.",
  "mapEditor.move.movedInside": "Lo moviste adentro del cuadrante.",
  "mapEditor.move.decision": "Qué pasa con {point}",
  "mapEditor.move.choose": "Elige qué pasa",
  "mapEditor.move.keep": "Dejarlo donde está",
  "mapEditor.move.remove": "Retirar el punto",
  "mapEditor.move.reason": "Motivo del cambio",

  "mapEditor.action.undo": "Deshacer esquina",
  "mapEditor.action.redraw": "Dibujar de nuevo",
  "mapEditor.action.saveQuadrant": "Guardar cuadrante",
  "mapEditor.action.saveSampling": "Guardar punto de muestreo",
  "mapEditor.action.saveRelease": "Guardar punto de liberación",
  "mapEditor.action.saveChanges": "Guardar cambios",
  "mapEditor.action.discard": "Descartar cambios",
  "mapEditor.action.list": "Ver lista",
  "mapEditor.action.open": "Editar mapa",

  "mapEditor.saved.quadrant": "Cuadrante guardado.",
  "mapEditor.saved.sampling": "Punto de muestreo guardado.",
  "mapEditor.saved.release": "Punto de liberación guardado.",
  "mapEditor.saved.changes": "Cambios guardados.",

  "mapEditor.error.duplicateCode": "Ya existe otro con ese nombre. Usa uno distinto.",
  "mapEditor.error.invalidCode": "Escribe un nombre de hasta 50 caracteres.",
  "mapEditor.error.pointOutside": "El punto quedó fuera de su manzana o de su cuadrante.",
  "mapEditor.error.shape":
    "La forma no es válida: revisa que las líneas no se crucen y que tenga al menos 3 esquinas.",
  "mapEditor.error.reason": "Escribe el motivo del cambio.",

  "mapEditor.legend.title": "Qué ves en el mapa",
  "mapEditor.legend.center": "Cuadrante de {center}",
  "mapEditor.legend.block": "Manzana",
  "mapEditor.legend.sampling": "Punto de muestreo",
  "mapEditor.legend.release": "Punto de liberación",
} as const satisfies AreaCatalog<"mapEditor">;
