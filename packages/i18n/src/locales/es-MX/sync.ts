/** Mexican Spanish messages of the `sync` area. Source of the `sync.*` key list. */
import type { AreaCatalog } from "../area.ts";

export const sync = {
  // Result of sending a record to the server (phone inbox)
  "sync.inbox.acceptedTitle": "Enviado",
  "sync.inbox.acceptedHint": "El servidor ya recibió este registro. No tienes que hacer nada más.",
  "sync.inbox.rejectedTitle": "No aceptado",
  "sync.inbox.rejectedHint":
    "El servidor no pudo aceptar este registro. Pídele a tu supervisor que lo revise.",
  "sync.inbox.inReviewTitle": "En revisión",
  "sync.inbox.inReviewHint":
    "Un supervisor revisará este registro. Mientras tanto no tienes que hacer nada.",

  // Per-event and per-batch codes of the sync answer (the API returns codes, never text)
  "sync.result.unsupportedEventType":
    "Este registro es de un tipo que el servidor no reconoce. Actualiza la app y vuelve a intentarlo; si sigue igual, avisa a tu supervisor.",
  "sync.result.unsupportedSchemaVersion":
    "Este registro usa un formato que el servidor no reconoce. Actualiza la app para poder enviarlo.",
  "sync.result.invalidPayload":
    "Algunos datos de este registro no son válidos. Revísalo; si no puedes corregirlo, avisa a tu supervisor.",
  "sync.result.eventPayloadTooLarge":
    "Este registro es demasiado grande para enviarse. Avisa a tu supervisor.",
  "sync.result.eventIdConflict":
    "Este registro choca con otro que ya existe en el servidor. Avisa a tu supervisor y no lo captures de nuevo.",
  "sync.result.voidTargetNotFound":
    "El registro que querías anular no existe en el servidor. Avisa a tu supervisor.",
  "sync.result.voidTargetNotOwned":
    "Solo quien capturó un registro puede anularlo. Pídele a tu supervisor que lo corrija.",
  "sync.result.alreadyVoided": "Este registro ya estaba anulado. No tienes que hacer nada más.",
  "sync.result.clockSkew":
    "La hora de tu teléfono parece estar mal, así que un supervisor revisará este registro. Revisa la fecha y la hora del teléfono.",
  "sync.result.finalUploadAfterRevoke":
    "Tu sesión ya había terminado cuando se envió este registro, así que un supervisor lo revisará. Inicia sesión de nuevo si necesitas seguir trabajando.",
  "sync.batch.deviceMismatch": "La sesión no corresponde a este teléfono. Inicia sesión de nuevo.",
  "sync.batch.payloadTooLarge":
    "El envío era demasiado grande, así que la app lo enviará en partes. No tienes que hacer nada.",
  "sync.batch.invalidCursor":
    "No pudimos actualizar tu bandeja, así que la app la pedirá completa otra vez. No tienes que hacer nada.",
  "sync.batch.syncInProgress":
    "Ya se está enviando información de tu cuenta desde otro teléfono. La app lo intentará de nuevo en unos segundos.",
} as const satisfies AreaCatalog<"sync">;
