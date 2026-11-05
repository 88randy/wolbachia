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
    "No se pudo actualizar el almacenamiento del teléfono. Libera espacio e inténtalo de nuevo; tus registros siguen guardados.",

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
  "mobile.settings.serverIdentityBound":
    "El servidor forma parte de la identidad de este tel\u00e9fono y no se puede cambiar aqu\u00ed. Llama a tu supervisor.",
  "mobile.settings.serverSaved": "Dirección guardada",
  "mobile.settings.serverInvalid":
    "La dirección no es válida. Escríbela completa, sin ruta, por ejemplo https://api.ejemplo.com",
  "mobile.settings.serverCleartext":
    "Usa https. Solo los builds de desarrollo permiten http en redes privadas, por ejemplo http://192.168.1.20:8000.",

  // Test tools (development builds only)
  "mobile.dev.title": "Pruebas (solo builds de desarrollo)",
  "mobile.dev.deviceId": "ID de este teléfono",
  "mobile.dev.addEvent": "Agregar registro de prueba",
  // P1/P2 authentication and local unlock
  "mobile.login.logo": "[Logo Codequim]",
  "mobile.login.title": "Entra a tu cuenta",
  "mobile.login.username": "Usuario",
  "mobile.login.password": "Contraseña",
  "mobile.login.showPassword": "Mostrar",
  "mobile.login.hidePassword": "Ocultar",
  "mobile.login.forgotPassword": "¿Olvidaste tu contraseña?",
  "mobile.login.callSupervisor": "Llama a tu supervisor. Él puede cambiarla desde la oficina.",
  "mobile.login.understood": "Entendido",
  "mobile.login.enter": "Entrar",
  "mobile.login.waitingSignal": "Entrar · esperando señal",
  "mobile.login.noSignal": "Necesitas señal la primera vez. Después podrás entrar sin señal.",
  "mobile.login.wrongCredentials": "Usuario o contraseña no coinciden. Revisa y vuelve a intentar.",
  "mobile.login.sessionEnded": "Tu sesión se cerró por seguridad. Entra de nuevo.",
  "mobile.login.deviceRevoked": "Este teléfono fue dado de baja. Llama a tu supervisor.",
  "mobile.login.genericError":
    "No pudimos iniciar sesión. Inténtalo de nuevo o llama a tu supervisor.",
  "mobile.login.throttled": "Demasiados intentos. Espera {minutes} min y vuelve a intentar.",
  "mobile.login.throttledUnknown": "Demasiados intentos. Espera un momento y vuelve a intentar.",
  "mobile.login.clockSkew": "La hora del teléfono no coincide.",
  "mobile.login.differentUser":
    "Hay registros pendientes de otra cuenta en este teléfono. Llama a tu supervisor antes de cambiar de usuario.",
  "mobile.login.onlineRequired":
    "Por seguridad necesitas entrar de nuevo con señal. Lo que capturaste sigue guardado en el teléfono.",
  "mobile.login.serverMissing":
    "Falta configurar el servidor. Abre la configuración del servidor o llama a tu supervisor.",
  "mobile.login.serverSettings": "Configurar servidor",
  "mobile.login.version": "Versión {version}",
  "mobile.unlock.greeting": "Hola, {name}",
  "mobile.unlock.enterPin": "Escribe tu PIN",
  "mobile.unlock.wrongPin": "PIN incorrecto. Te quedan {count} intentos.",
  "mobile.unlock.passwordTitle": "Escribe tu contraseña",
  "mobile.unlock.passwordRequired":
    "Se alcanzó el límite de {count} intentos de PIN. Por seguridad, entra con tu contraseña completa.",
  "mobile.unlock.savedWork": "Lo que capturaste sigue guardado en el teléfono.",
  "mobile.unlock.wrongSecret": "No coincide. Revisa y vuelve a intentar.",
  "mobile.unlock.biometric": "Usar huella",
  "mobile.unlock.biometricPrompt": "Desbloquea con tu huella",
  "mobile.unlock.cancel": "Cancelar",
  "mobile.unlock.erase": "Borrar",
  "mobile.unlock.createTitle": "Crea tu PIN",
  "mobile.unlock.createPin": "Escribe un PIN de 4 dígitos.",
  "mobile.unlock.confirmPin": "Confirma tu PIN.",
  "mobile.unlock.trivialPin": "Elige 4 dígitos que no sean iguales ni consecutivos.",
  "mobile.unlock.pinMismatch": "Los PIN no coinciden. Crea tu PIN de nuevo.",
  "mobile.unlock.pinProgress": "Dígitos capturados: {count} de 4.",
  "mobile.unlock.idleWarning": "Se bloqueará en 1 minuto.",
  "mobile.unlock.keepWorking": "Seguir trabajando",
  "mobile.unlock.resumeSetup": "Para terminar de crear tu PIN, escribe tu contraseña.",
  "mobile.unlock.wrongPinLast": "PIN incorrecto. Te queda 1 intento.",
} as const satisfies AreaCatalog<"mobile">;
