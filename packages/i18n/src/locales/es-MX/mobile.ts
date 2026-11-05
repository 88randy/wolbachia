/** Mexican Spanish messages of the `mobile` area (courier app shell and sync inbox). Source of the `mobile.*` key list. */
import type { AreaCatalog } from "../area.ts";

export const mobile = {
  // Boot
  "mobile.boot.loading": "Preparando la app",
  "mobile.boot.storageFailed":
    "No se pudo abrir el almacenamiento del teléfono. Cierra y abre la app; si sigue igual, avisa a soporte.",
  "mobile.storage.saveFailed":
    "No se pudo guardar en el teléfono. Libera espacio e inténtalo de nuevo; nada se envió.",

  "mobile.storage.actionFailed":
    "No se pudo actualizar el almacenamiento del tel?fono. Libera espacio e int?ntalo de nuevo; tus registros siguen guardados.",

  // Navigation
  "mobile.nav.back": "Atrás",
  "mobile.nav.settings": "Ajustes",

  // Home (placeholder until the epics bring the real screens)
  "mobile.home.title": "Inicio",
  "mobile.home.placeholder":
    "Aquí irá tu jornada. Esta versión solo prepara el envío de registros.",
  "mobile.home.serverMissing":
    "La dirección del servidor no está configurada. Configúrala en Ajustes para poder enviar tus registros.",

  // Top-bar sync chip
  "mobile.chip.allSent": "Todo enviado",
  "mobile.chip.toUpload": "{count} por subir",
  "mobile.chip.noSignal": "Sin señal · {count} por subir",
  "mobile.chip.noSignalEmpty": "Sin señal",
  "mobile.chip.error": "Error: revisar",
  "mobile.chip.hint": "Abre la bandeja de envíos",

  // Sync inbox (P28)
  "mobile.inbox.title": "Envíos",
  "mobile.inbox.lastConnection": "Última conexión: {time}",
  "mobile.inbox.neverConnected": "Aún no hay conexión con el servidor",
  "mobile.inbox.problems": "Con problema",
  "mobile.inbox.onPhone": "En el teléfono · {count}",
  "mobile.inbox.sent": "Enviados · {count}",
  "mobile.inbox.tryNow": "Intentar ahora",
  "mobile.inbox.empty": "No hay registros todavía. Lo que captures aparecerá aquí.",
  "mobile.inbox.groupTitle": "{count} · {label}",
  "mobile.inbox.timeRange": "{from} a {to}",
  "mobile.inbox.offline":
    "Sin señal. Tus registros están guardados y se enviarán cuando vuelva la conexión.",
  "mobile.inbox.rejectionQuota":
    "Se alcanz? el l?mite diario de registros por revisar. Tus registros siguen guardados; se enviar?n despu?s de la espera indicada por el servidor.",
  "mobile.inbox.waitingRetry":
    "No pudimos conectar con el servidor. La app lo intentará de nuevo sola.",
  "mobile.inbox.parkedHint":
    "Este registro no se pudo enviar tal como está. Pulsa «Intentar ahora»; si se repite, avisa a tu supervisor.",

  // Why sending is paused
  "mobile.blocked.needsLogin":
    "Tu sesión terminó. Inicia sesión para que se envíen tus registros; no se perdió nada.",
  "mobile.blocked.clockWrong":
    "La fecha y la hora del teléfono no son correctas. Corrígelas en los ajustes del teléfono y tus registros se enviarán solos.",
  "mobile.blocked.noServer":
    "La dirección del servidor no está configurada. Configúrala en Ajustes para que se envíen tus registros; no se perdió nada.",
  "mobile.blocked.forbidden":
    "Tu cuenta no puede enviar registros por ahora. Avisa a tu supervisor; tus registros están guardados.",

  // Status badges (sent, rejected and in review reuse `sync.inbox.*Title`)
  "mobile.status.pending": "Por subir",
  "mobile.status.sending": "Enviando",
  "mobile.status.error": "No se pudo enviar",

  // Record types (the `type` of an event)
  "mobile.eventType.recordVoid": "Anulaciones",
  "mobile.eventType.shiftOpen": "Aperturas de jornada",
  "mobile.eventType.shiftClose": "Cierres de jornada",
  "mobile.eventType.locationPing": "Ubicaciones",
  "mobile.eventType.suppliesReceive": "Recepciones de insumos",
  "mobile.eventType.suppliesReconcile": "Conciliaciones de insumos",
  "mobile.eventType.ovitrapPlace": "Ovitrampas colocadas",
  "mobile.eventType.ovitrapCheck": "Ovitrampas revisadas",
  "mobile.eventType.ovitrapReplace": "Ovitrampas reemplazadas",
  "mobile.eventType.ovitrapRelocate": "Ovitrampas reubicadas",
  "mobile.eventType.ovitrapRemove": "Ovitrampas retiradas",
  "mobile.eventType.releaseRecord": "Liberaciones",
  "mobile.eventType.sampleCollect": "Muestras",
  "mobile.eventType.fuelLoad": "Cargas de gasolina",
  "mobile.eventType.incidentReport": "Incidentes",
  "mobile.eventType.emergencyAccident": "Emergencias",
  "mobile.eventType.communityActivity": "Actividades con la comunidad",
  "mobile.eventType.unknown": "Otros registros",

  // Settings
  "mobile.settings.title": "Ajustes",
  "mobile.settings.darkMode": "Modo oscuro",
  "mobile.settings.darkModeHint": "Para noche o interiores",
  "mobile.settings.language": "Idioma",
  "mobile.settings.languageEs": "Español (México)",
  "mobile.settings.languageEn": "English",
  "mobile.settings.server": "Servidor",
  "mobile.settings.serverHint": "Dirección de la API, por ejemplo https://api.ejemplo.com",
  "mobile.settings.serverSave": "Guardar dirección",
  "mobile.settings.serverReset": "Usar la del build",
  "mobile.settings.serverSaved": "Dirección guardada",
  "mobile.settings.serverInvalid":
    "La dirección no es válida. Escríbela completa, sin ruta, por ejemplo https://api.ejemplo.com",
  "mobile.settings.serverCleartext":
    "Usa https. Solo los builds de desarrollo permiten http en redes privadas, por ejemplo http://192.168.1.20:8000.",

  // Test tools (development builds only)
  "mobile.dev.title": "Pruebas (solo builds de desarrollo)",
  "mobile.dev.deviceId": "ID de este teléfono",
  "mobile.dev.tokenLabel": "Token de acceso de prueba",
  "mobile.dev.tokenUse": "Usar token",
  "mobile.dev.addEvent": "Agregar registro de prueba",
} as const satisfies AreaCatalog<"mobile">;
