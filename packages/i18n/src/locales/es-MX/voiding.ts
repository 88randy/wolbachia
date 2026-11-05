/** Mexican Spanish messages of the `voiding` area (void with reason, #32). */
import type { AreaCatalog } from "../area.ts";

export const voiding = {
  // Void dialog. `{record}` is the code or name of the record, e.g. "OV-010".
  "voiding.dialog.title": "Anular {record}",
  "voiding.dialog.hint": "No se borra: queda tachado en el historial con tu motivo.",
  "voiding.dialog.reasonLabel": "Motivo de anulación (obligatorio)",
  "voiding.dialog.details": "Detalle",
  "voiding.dialog.placeholder": "Selecciona un motivo",
  "voiding.dialog.loading": "Cargando motivos…",
  "voiding.dialog.retry": "Reintentar",
  "voiding.dialog.required": "obligatorio",
  "voiding.dialog.minHelp": "Escribe al menos {min} caracteres para que el motivo sirva después.",
  "voiding.dialog.counterBelow": "{count} de {min} caracteres mínimos",
  "voiding.dialog.counterOk": "{count} de {max} caracteres como máximo",
  "voiding.dialog.confirm": "Anular",
  "voiding.dialog.busy": "Anulando…",

  // What went wrong. Generic failures use `errors.api.*`.
  "voiding.error.chooseReason": "Elige un motivo.",
  "voiding.error.catalogUnavailable":
    "No pudimos cargar los motivos disponibles. Reintenta para continuar.",
  "voiding.error.title": "No pudimos anular",
  "voiding.error.codeUnknown":
    "Este motivo ya no está disponible. Elige otro motivo de la lista actualizada.",
  "voiding.error.requiredForOther": "Escribe el motivo al elegir Otro (especificar).",
  "voiding.error.tooShort": "El motivo necesita al menos {min} caracteres. Cuéntanos un poco más.",
  "voiding.error.invalidCharacters":
    "El motivo tiene caracteres que no se pueden guardar (de control o que cambian el sentido del texto). Quítalos y vuelve a intentar.",
  "voiding.error.alreadyVoided": "Alguien ya anuló este registro. Actualiza la página para verlo.",
  "voiding.error.blocked":
    "Este registro ya no se puede anular en su estado actual. Actualiza la página para ver qué cambió.",
} as const satisfies AreaCatalog<"voiding">;
