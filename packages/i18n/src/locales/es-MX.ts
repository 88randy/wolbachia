/**
 * Mexican Spanish catalog. This file is the SOURCE of the key list:
 * `MessageKey` is derived from it and `en.ts` must provide the same keys.
 *
 * Keys follow `area.screen.element` (see README). Placeholders are `{name}`.
 */
export const esMX = {
  // Common actions
  'common.actions.save': 'Guardar',
  'common.actions.cancel': 'Cancelar',
  'common.actions.retry': 'Reintentar',
  'common.actions.close': 'Cerrar',
  'common.actions.void': 'Anular',

  // Common fields
  'common.fields.voidReason': 'Motivo de la anulación',
  'common.fields.otherSpecify': 'Otro (especificar)',

  // API errors: the API returns `code` + `params`, never text
  'errors.api.generic': 'No pudimos completar la acción. Inténtalo de nuevo.',
  'errors.api.network': 'No hay conexión con el servidor. Revisa tu señal e inténtalo de nuevo.',
  'errors.api.validation': 'Hay datos que no son válidos. Revisa los campos marcados y corrígelos.',
  'errors.api.notFound': 'No encontramos lo que buscas. Regresa e inténtalo de nuevo.',
  'errors.api.permissionDenied': 'No tienes permiso para hacer esto. Pídele acceso a tu supervisor.',
  'errors.api.blocked': 'Esta acción está bloqueada por ahora. Avisa a {role} para que la desbloquee.',
  'errors.api.sessionRevoked': 'Tu sesión terminó. Inicia sesión de nuevo para continuar.',
  'errors.api.rateLimited': 'Hiciste muchas solicitudes seguidas. Espera {seconds} segundos e inténtalo de nuevo.',
  'errors.api.serverError': 'Algo falló de nuestro lado. Inténtalo en unos minutos; si sigue igual, avisa a soporte.',

  // Result of sending a record to the server (phone inbox)
  'sync.inbox.acceptedTitle': 'Enviado',
  'sync.inbox.acceptedHint': 'El servidor ya recibió este registro. No tienes que hacer nada más.',
  'sync.inbox.rejectedTitle': 'No aceptado',
  'sync.inbox.rejectedHint': 'El servidor no pudo aceptar este registro. Pídele a tu supervisor que lo revise.',
  'sync.inbox.inReviewTitle': 'En revisión',
  'sync.inbox.inReviewHint': 'Un supervisor revisará este registro. Mientras tanto no tienes que hacer nada.',
} as const;

/** Every key of the catalog. */
export type MessageKey = keyof typeof esMX;
