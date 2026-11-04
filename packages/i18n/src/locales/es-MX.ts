/**
 * Mexican Spanish catalog. This file is the SOURCE of the key list:
 * `MessageKey` is derived from it and `en.ts` must provide the same keys.
 *
 * Keys follow `area.screen.element` (see README). Placeholders are `{name}`.
 */
export const esMX = {
  // Common actions
  "common.actions.save": "Guardar",
  "common.actions.cancel": "Cancelar",
  "common.actions.retry": "Reintentar",
  "common.actions.close": "Cerrar",
  "common.actions.goHome": "Ir al inicio",
  "common.actions.void": "Anular",

  // Common fields
  "common.fields.voidReason": "Motivo de la anulación",
  "common.fields.otherSpecify": "Otro (especificar)",

  // API errors: the API returns `code` + `params`, never text
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

  // Web shell: brand, skip link, sidebar, top bar
  "shell.brand.name": "Wolbachia",
  "shell.brand.mark": "CQ",
  "shell.a11y.skipToContent": "Saltar al contenido",
  "shell.nav.label": "Navegación principal",
  "shell.sidebar.collapse": "Colapsar menú",
  "shell.topBar.searchLabel": "Buscar",
  "shell.topBar.searchPlaceholder": "Busca o escanea",
  "shell.topBar.notificationsSoon": "Todavía no está disponible.",
  "shell.topBar.notifications": "Notificaciones",
  "shell.language.toEnglish": "ES: cambiar idioma a inglés",
  "shell.language.toSpanish": "EN: cambiar idioma a español",

  // Web shell: sidebar groups and areas (one entry per area of web/README.md)
  "shell.group.operation": "Operación",
  "shell.group.resources": "Recursos",
  "shell.group.analysis": "Análisis y administración",
  "shell.nav.home": "Inicio",
  "shell.nav.incidents": "Incidentes",
  "shell.nav.operations": "Supervisión",
  "shell.nav.quadrants": "Cuadrantes y muestreo",
  "shell.nav.releases": "Liberaciones",
  "shell.nav.community": "Comunidad",
  "shell.nav.inventory": "Inventario",
  "shell.nav.fleet": "Flota",
  "shell.nav.lab": "Laboratorio",
  "shell.nav.people": "Personal",
  "shell.nav.dashboards": "Tableros",
  "shell.nav.regulatory": "Regulatorio",
  "shell.nav.settings": "Configuración",

  // Web global states
  "states.placeholder.body": "Esta sección todavía está en construcción.",
  "states.loading.label": "Cargando contenido",
  "states.notFound.title": "No encontramos esta página",
  "states.notFound.body":
    "La dirección no existe o ya no está disponible. Regresa al inicio e inténtalo de nuevo.",
  "states.error.title": "Algo salió mal en esta pantalla",
  "states.error.body": "Puedes reintentar o regresar al inicio. Si sigue igual, avisa a soporte.",
  "states.config.title": "La aplicación no está lista",
  "states.config.missingApiUrl":
    "La dirección del servidor no está configurada o no es válida. Avisa a soporte técnico para que la corrijan.",
  "states.offline.banner":
    "Sin conexión. Lo que ves puede no estar actualizado; se actualizará cuando vuelva la red.",

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
    "El envío es demasiado grande. Inténtalo de nuevo; si sigue igual, avisa a soporte técnico.",
  "sync.batch.invalidCursor": "No pudimos actualizar tu bandeja. Inténtalo de nuevo en un momento.",
} as const;

/** Every key of the catalog. */
export type MessageKey = keyof typeof esMX;
