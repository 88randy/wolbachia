/** Mexican Spanish messages of the `voiding` area (void with reason, #32). */
import type { AreaCatalog } from "../area.ts";

export const voiding = {
  // Void dialog. `{record}` is the code or name of the record, e.g. "OV-010".
  "voiding.dialog.title": "Anular {record}",
  "voiding.dialog.hint": "No se borra: queda tachado en el historial con tu motivo.",
  "voiding.dialog.required": "obligatorio",
  "voiding.dialog.minHelp": "Escribe al menos {min} caracteres para que el motivo sirva después.",
  "voiding.dialog.counterBelow": "{count} de {min} caracteres mínimos",
  "voiding.dialog.counterOk": "{count} de {max} caracteres como máximo",
  "voiding.dialog.confirm": "Anular",
  "voiding.dialog.busy": "Anulando…",

  // What went wrong. Generic failures use `errors.api.*`.
  "voiding.error.title": "No pudimos anular",
  "voiding.error.tooShort": "El motivo necesita al menos {min} caracteres. Cuéntanos un poco más.",
  "voiding.error.alreadyVoided": "Alguien ya anuló este registro. Actualiza la página para verlo.",
  "voiding.error.blocked":
    "Este registro ya no se puede anular, porque otra parte del sistema depende de él.",

  // A voided record in a list or a record page
  "voiding.mark.badge": "Anulado",
  "voiding.mark.reason": "Motivo: {reason}",
  "voiding.mark.author": "Anuló: {author}",
  "voiding.mark.when": "Fecha: {when}",
} as const satisfies AreaCatalog<"voiding">;
