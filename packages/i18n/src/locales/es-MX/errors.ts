/** Mexican Spanish messages of the `errors` area. Source of the `errors.*` key list. */
import type { AreaCatalog } from "../area.ts";

export const errors = {
  // API errors: the API returns `code` + `params`, never text
  "errors.api.immutableCode":
    "El código no se puede cambiar. Anula la motocicleta y crea otra con el código correcto.",
  "errors.api.motorcycleNotBlocked":
    "La motocicleta ya está desbloqueada. Actualiza la lista para ver su estado.",
  "errors.api.motorcycleInUse":
    "La motocicleta tiene una jornada abierta. Cierra la jornada antes de anularla.",
  "errors.api.duplicateCode":
    "Ese código ya está registrado. Usa otro código e inténtalo de nuevo.",
  "errors.api.generic": "No pudimos completar la acción. Inténtalo de nuevo.",
  "errors.api.network": "No hay conexión con el servidor. Revisa tu señal e inténtalo de nuevo.",
  "errors.api.validation": "Hay datos que no son válidos. Revisa los campos marcados y corrígelos.",
  "errors.api.notFound": "No encontramos lo que buscas. Regresa e inténtalo de nuevo.",
  "errors.api.permissionDenied":
    "No tienes permiso para hacer esto. Pídele acceso a tu supervisor.",
  "errors.api.blocked": "Esta acción está bloqueada por ahora. Quien puede desbloquearla: {role}.",
  "errors.api.sessionRevoked": "Tu sesión terminó. Inicia sesión de nuevo para continuar.",
  "errors.api.rateLimited":
    "Hiciste muchas solicitudes seguidas. Espera un momento e inténtalo de nuevo.",
  "errors.api.serverError":
    "Algo falló de nuestro lado. Inténtalo en unos minutos; si sigue igual, avisa a soporte.",
} as const satisfies AreaCatalog<"errors">;
