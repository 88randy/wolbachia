/** Mexican Spanish messages for code scanning: the camera reader and scan-and-fill forms. */
import type { AreaCatalog } from "../area.ts";

export const scan = {
  "scan.camera.open": "Escanear con la cámara",
  "scan.camera.title": "Escanear con la cámara",
  "scan.camera.videoLabel": "Imagen de la cámara",
  "scan.camera.hint": "Pon el código de la etiqueta frente a la cámara. Se lee solo.",
  "scan.camera.starting": "Abriendo la cámara…",
  "scan.camera.scanning": "Buscando el código…",
  "scan.camera.denied":
    "No tenemos permiso para usar la cámara. Permítela en tu navegador y vuelve a intentar.",
  "scan.camera.unavailable": "No encontramos una cámara en este equipo. Escribe el código a mano.",
  "scan.camera.failed": "No pudimos abrir la cámara. Vuelve a intentar.",
  "scan.camera.retry": "Volver a intentar",
  "scan.camera.close": "Cerrar",
  "scan.camera.torchOn": "Encender la luz",
  "scan.camera.torchOff": "Apagar la luz",
  "scan.camera.read": "Código leído: {code}",
  "scan.kind.lot": "de un lote",
  "scan.kind.bag": "de una bolsa",
  "scan.kind.location": "de una ubicación",
  "scan.kind.motorcycle": "de una moto",
  "scan.kind.paddle": "de una papeleta",
  "scan.kind.ovitrap": "de una ovitrampa",
  "scan.kind.other": "de otro tipo de registro",
  "scan.wrongKind": "Esta etiqueta es {found}, no {expected}.",
  "scan.missing": "No encontramos el registro de esta etiqueta. Revisa que sea la correcta.",
  "scan.lot.title": "Llenar con un código",
  "scan.lot.hint":
    "Escanea la etiqueta del proveedor y llenamos el código, la caducidad, la cantidad y el insumo. Si escaneas una etiqueta nuestra, abrimos ese lote.",
  "scan.lot.label": "Código de la etiqueta",
  "scan.lot.loading": "Buscando…",
  "scan.lot.filled": "Llenamos: {fields}. Revisa que todo esté bien y guarda.",
  "scan.lot.field.code": "el código del lote",
  "scan.lot.field.expiry": "la fecha de caducidad",
  "scan.lot.field.quantity": "la cantidad",
  "scan.lot.field.supply": "el insumo",
  "scan.lot.noSupply":
    "Este código de barras todavía no está en el catálogo. Elige el insumo de la lista.",
  "scan.lot.nothing": "No pudimos sacar datos de este código. Llena el formulario a mano.",
  "scan.lot.unknown": "No encontramos un lote con ese código. Revisa la etiqueta.",
  "scan.lot.failed": "No pudimos buscar el código. Inténtalo de nuevo.",
} as const satisfies AreaCatalog<"scan">;
