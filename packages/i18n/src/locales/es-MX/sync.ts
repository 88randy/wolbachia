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
  "sync.result.voidReasonCodeUnknown":
    "Este motivo ya no está disponible. Actualiza los catálogos y elige otro motivo.",
  "sync.result.voidReasonCodeDeactivated":
    "Este motivo cambió desde la última actualización. Un supervisor revisará la anulación; el registro original sigue intacto.",
  "sync.result.alreadyVoided": "Este registro ya estaba anulado. No tienes que hacer nada más.",
  "sync.result.clockSkew":
    "La hora de tu teléfono parece estar mal, así que un supervisor revisará este registro. Revisa la fecha y la hora del teléfono.",
  "sync.result.finalUploadAfterRevoke":
    "Tu sesión ya había terminado cuando se envió este registro, así que un supervisor lo revisará. Inicia sesión de nuevo si necesitas seguir trabajando.",
  "sync.result.shiftAlreadyOpen":
    "Ya tienes una jornada abierta, así que no se inició otra. Continúa con la jornada abierta o ciérrala primero.",
  "sync.result.motorcycleInUse":
    "Esta moto ya está en una jornada abierta. Elige otra o avisa a tu supervisor.",
  "sync.result.capturedAfterShiftClose":
    "Este registro se capturó después de cerrar la jornada. Se guardó y un supervisor lo revisará. No tienes que hacer nada.",
  "sync.result.motorcycleUnknown":
    "El servidor no conoce esta moto. Revisa el código e inténtalo de nuevo; si sigue igual, avisa a tu supervisor.",
  "sync.result.motorcycleBlocked":
    "Esta moto no se puede usar por ahora. Elige otra o avisa a tu supervisor.",
  "sync.result.odometerOutOfRange":
    "El kilometraje no es posible. Revisa el número del tablero y captúralo de nuevo.",
  "sync.result.shiftNotOpen":
    "Esta jornada no está abierta en el servidor. Avisa a tu supervisor si aún necesitas trabajar.",
  "sync.result.shiftEventNotVoidable":
    "Una jornada no se puede anular desde el teléfono. Pide a tu supervisor que la corrija.",
  "sync.result.odometerDecreased":
    "El kilometraje es menor que el anterior, así que un supervisor lo revisará. No tienes que hacer nada mientras tanto.",
  "sync.result.severeCheck":
    "Reportaste una falla grave, así que la moto queda bloqueada y un supervisor lo revisará.",
  "sync.batch.deviceMismatch": "La sesión no corresponde a este teléfono. Inicia sesión de nuevo.",
  "sync.batch.payloadTooLarge":
    "El envío era demasiado grande, así que la app lo enviará en partes. No tienes que hacer nada.",
  "sync.batch.invalidCursor":
    "No pudimos actualizar tu bandeja, así que la app la pedirá completa otra vez. No tienes que hacer nada.",
  "sync.batch.syncInProgress":
    "Ya se está enviando información de tu cuenta desde otro teléfono. La app lo intentará de nuevo en unos segundos.",
  "sync.result.fuelMotorcycleMismatch":
    "La carga corresponde a otra motocicleta. Avisa a tu supervisor para revisarla.",
  "sync.result.fuelEfficiencyReview":
    "La carga se guardó para revisión del rendimiento. Puedes cerrar tu jornada y avisar a tu supervisor.",
  "sync.result.fuelEventNotVoidable":
    "Esta carga necesita una corrección autorizada. Pide apoyo a tu supervisor.",
  "sync.result.ovitrapPointInaccessible":
    "El punto no está disponible para tu alcance. Consulta a tu supervisor.",
  "sync.result.ovitrapInaccessible":
    "La ovitrampa no está disponible para tu alcance. Consulta a tu supervisor.",
  "sync.result.ovitrapIdentityUsed":
    "Esta identidad ya se utilizó. Consulta a tu supervisor antes de corregirla.",
  "sync.result.ovitrapPointOccupied":
    "El punto ya tiene una ovitrampa activa. Consulta a tu supervisor.",
  "sync.result.ovitrapReadingExists":
    "La semana ya tiene una lectura activa. Anula la lectura anterior antes de corregirla.",
  "sync.result.ovitrapBagCodeUsed":
    "El código de bolsa ya se utilizó. Revisa el código con tu supervisor.",
  "sync.result.ovitrapCatalogItemUnknown":
    "La opción no pertenece al catálogo descargado. Consulta a tu supervisor.",
  "sync.result.ovitrapCatalogItemDeactivated":
    "La opción fue desactivada. Tu supervisor revisará la captura.",
  "sync.result.ovitrapCatalogVersionUnavailable":
    "No se pudo recuperar el catálogo usado. Tu supervisor revisará la captura.",
  "sync.result.ovitrapGpsUnusable":
    "La ubicación no tiene precisión suficiente. Tu supervisor revisará la captura.",
  "sync.result.ovitrapRulesUnavailable":
    "Faltan reglas válidas para esa captura. Tu supervisor la revisará.",
  "sync.result.ovitrapPointVersionUnavailable":
    "No hay una ubicación vigente del punto para esa captura. Tu supervisor la revisará.",
  "sync.result.ovitrapTooFar":
    "La captura está fuera de la distancia permitida. Tu supervisor la revisará.",
  "sync.result.ovitrapSpeedAnomaly":
    "El desplazamiento necesita revisión. Tu supervisor revisará la captura.",
  "sync.result.ovitrapVoidBlocked":
    "Hay lecturas vinculadas a esta colocación. Consulta a tu supervisor para corregirlas.",
  "sync.result.ovitrapStaleIdentity":
    "La identidad f?sica cambi?. Tu supervisor revisar? la captura sin perder la evidencia.",
  "sync.result.ovitrapEvidenceRequired":
    "Falta evidencia fotogr?fica. Tu supervisor revisar? la captura; conserva los archivos pendientes.",
} as const satisfies AreaCatalog<"sync">;
