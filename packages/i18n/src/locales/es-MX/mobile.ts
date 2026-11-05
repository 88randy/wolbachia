/** Mexican Spanish messages of the `mobile` area (courier app shell and sync inbox). Source of the `mobile.*` key list. */
import type { AreaCatalog } from "../area.ts";

export const mobile = {
  // M-06: P9-P10 day list and offline map
  "mobile.day.loading": "Cargando puntos guardados…",
  "mobile.day.updating": "Actualizando…",
  "mobile.day.readFailed": "No pudimos leer los puntos guardados. Intenta leerlos otra vez.",
  "mobile.day.mapFailed": "No pudimos verificar el mapa guardado. Intenta de nuevo o usa la lista.",
  "mobile.day.actionFailed":
    "No pudimos completar la acción local. Intenta otra vez; tus registros siguen guardados.",
  "mobile.day.backHome": "Volver al inicio",
  "mobile.day.showDetails": "Ver detalles del error",
  "mobile.day.hideDetails": "Ocultar detalles del error",
  "mobile.day.errorCode": "Código: {code}",

  "mobile.day.historyEntry": "{date} · {summary}",
  "mobile.day.title": "Mi día",
  "mobile.day.open": "Ver puntos del día",
  "mobile.day.list": "Lista",
  "mobile.day.map": "Mapa",
  "mobile.day.progress": "{reviewed} de {total} puntos revisados",
  "mobile.day.pending": "Pendientes · Alto Riesgo primero",
  "mobile.day.closedSection": "Casas cerradas por volver hoy",
  "mobile.day.reviewedSection": "Puntos revisados",
  "mobile.day.empty":
    "No tienes puntos asignados guardados. Cuando haya señal, actualiza la lista.",
  "mobile.day.ready":
    "Listo por hoy. Puedes ir al inicio para cerrar tu jornada cuando esté disponible.",
  "mobile.day.refresh": "Actualizar lista",
  "mobile.day.refreshFailed":
    "No pudimos actualizar. Puedes usar los puntos guardados e intentar otra vez.",
  "mobile.day.unreadable":
    "Filas que no se pudieron leer: {count}. Actualiza o pide ayuda al supervisor.",
  "mobile.day.keptNotice":
    "Cambió la asignación. Conservamos estos puntos por trabajo pendiente: {codes}. Consulta al supervisor.",
  "mobile.day.kept": "Conservado: trabajo pendiente",
  "mobile.day.highRisk": "Alto Riesgo",
  "mobile.day.pendingStatus": "Pendiente hoy",
  "mobile.day.doneStatus": "Revisado",
  "mobile.day.closedStatus": "Casa cerrada · volver",
  "mobile.day.relocateStatus": "Por reubicar",
  "mobile.day.unknownStatus": "Estado por confirmar",
  "mobile.day.phoneSaved": "Guardado en el teléfono",
  "mobile.day.serverReceived": "Recibido por el servidor · revisión aparte",
  "mobile.day.reviewUnconfirmed": "Revisión del servidor sin confirmar",
  "mobile.day.place": "Colocar",
  "mobile.day.check": "Revisar",
  "mobile.day.replace": "Reemplazar",
  "mobile.day.relocate": "Reubicar",
  "mobile.day.remove": "Retirar",
  "mobile.day.block": "Manzana {code}",
  "mobile.day.distance": "{distance} m",
  "mobile.day.navigate": "Cómo llegar",
  "mobile.day.go": "Ir",
  "mobile.day.history": "Historial reciente",
  "mobile.day.historyEmpty": "No hay historial guardado.",
  "mobile.day.historyUnknown": "Detalle de visita no disponible",
  "mobile.day.historyOk": "Bien · papeleta entregada",
  "mobile.day.historyDry": "Sin agua · reinstalada",
  "mobile.day.reference": "Referencia: {reference}",
  "mobile.day.noReference": "No hay referencia guardada.",
  "mobile.day.scanHint":
    "Para registrar, escanea el QR de la ovitrampa cuando el escáner esté disponible.",
  "mobile.day.backList": "Ver lista de puntos",
  "mobile.day.closeDetail": "Cerrar detalle",
  "mobile.day.noMap": "No tienes el mapa guardado",
  "mobile.day.noMapHint":
    "No hay un archivo de mapa verificado disponible. Intenta verificar de nuevo o usa la lista de puntos.",
  "mobile.day.retryMap": "Verificar mapa otra vez",
  "mobile.day.outsideCoverage": "Fuera de la cobertura descargada",
  "mobile.day.attribution": "© OpenStreetMap contributors",
  "mobile.day.mapLabel": "Mapa sin conexión de puntos asignados",
  "mobile.day.locationDenied": "Ubicación no autorizada. Puedes seguir con la lista.",
  "mobile.day.locationUnavailable": "Ubicación no disponible. Puedes seguir con la lista.",
  "mobile.day.locationStale":
    "Ubicación desactualizada · hace {seconds} s. No se muestran distancias.",
  "mobile.day.locationFix": "Ubicación · hace {seconds} s · precisión ±{accuracy} m",
  "mobile.day.locationUnknownAccuracy": "Ubicación · hace {seconds} s · precisión no disponible",
  "mobile.day.locationWeak": "Ubicación aproximada · hace {seconds} s · precisión ±{accuracy} m",
  "mobile.day.launched": "Se abrió el navegador. Al volver, este punto seguirá seleccionado.",
  "mobile.day.noHandler":
    "No hay una app de navegación disponible. Usa las coordenadas y la referencia; la lista sigue disponible.",
  "mobile.day.denied":
    "No se pudo abrir el navegador. Pide al administrador que revise el acceso. Puedes usar las coordenadas y la referencia.",
  "mobile.day.invalidCoordinates":
    "Las coordenadas no son válidas. Usa la lista y consulta al supervisor.",
  "mobile.day.coordinates": "Coordenadas: {coordinates}",
  // M-04: P3-P7 shift opening
  "mobile.shiftOpen.catalogChanged":
    "El catálogo cambió. Revisa los puntos y confirma la nueva versión. Si una falla registrada ya no aparece, pide ayuda a tu supervisor; conservamos la evidencia.",
  "mobile.shiftOpen.confirmCatalog": "Confirmar catálogo y volver a revisar",
  "mobile.shiftOpen.start": "Abrir jornada",
  "mobile.shiftOpen.resume": "Retomar apertura",
  "mobile.shiftOpen.noShift": "Aún no abres jornada",
  "mobile.shiftOpen.opened": "Jornada guardada en este teléfono",
  "mobile.shiftOpen.noAssignment":
    "La asignación de zona aún no está disponible en esta versión. Puedes preparar tu jornada.",
  "mobile.shiftOpen.inbox": "Ver envíos",
  "mobile.shiftOpen.motorcycleTitle": "Paso 1 de 4 · Elige tu moto",
  "mobile.shiftOpen.motorcycleHint":
    "Escribe y confirma el código de la moto. El servidor comprobará si existe, está bloqueada o está en uso al sincronizar.",
  "mobile.shiftOpen.motorcycleCode": "Código de la moto",
  "mobile.shiftOpen.continue": "Continuar",
  "mobile.shiftOpen.checklistTitle": "Paso 2 de 4 · Revisa tu moto",
  "mobile.shiftOpen.unconfigured":
    "La lista de seguridad no está configurada. Descarga el catálogo o pide a tu supervisor que lo configure. No puedes salir.",
  "mobile.shiftOpen.catalogUnavailable":
    "No se pudo actualizar el catálogo. Conservamos la última copia guardada. Revisa tu sesión y conexión y vuelve a intentar.",
  "mobile.shiftOpen.refreshCatalog": "Actualizar catálogo de seguridad",
  "mobile.shiftOpen.ok": "Bien",
  "mobile.shiftOpen.minor": "Falla leve",
  "mobile.shiftOpen.severeResult": "Falla grave",
  "mobile.shiftOpen.note": "Observación (opcional)",
  "mobile.shiftOpen.requiredNote": "Observación obligatoria",
  "mobile.shiftOpen.odometerTitle": "Paso 3 de 4 · Km inicial",
  "mobile.shiftOpen.photoHint":
    "La foto del odómetro es opcional, salvo que el catálogo requiera evidencia. Las fotos guardadas permanecen en este teléfono.",
  "mobile.shiftOpen.capturePhoto": "Tomar foto",
  "mobile.shiftOpen.photoUnavailable":
    "La cámara no está disponible en esta versión. Conservamos tu captura; si se requiere foto, no podrás salir.",
  "mobile.shiftOpen.photoCount": "Fotos guardadas en este teléfono:",
  "mobile.shiftOpen.odometerKm": "Km que marca el odómetro (entero)",
  "mobile.shiftOpen.lastOdometer": "Último km conocido por este teléfono:",
  "mobile.shiftOpen.unknownOdometer":
    "Sin referencia local; el servidor la comprobará al sincronizar.",
  "mobile.shiftOpen.odometerWarning":
    "Es menor que el último km conocido. Revisa la lectura; puedes continuar sin perderla. El servidor podrá ponerla en revisión.",
  "mobile.shiftOpen.mapsTitle": "Paso 4 de 4 · Preparar mapa",
  "mobile.shiftOpen.mapReady":
    "Mapa verificado y con cobertura. Puedes continuar si la revisión de la moto está completa.",
  "mobile.shiftOpen.mapUnavailable":
    "El mapa aún no está listo. Esta versión no tiene el manifiesto de mapas. No puedes salir; vuelve a intentar cuando esté disponible.",
  "mobile.shiftOpen.mapPreparing":
    "Preparando mapa. La salida sigue bloqueada hasta verificar archivos y cobertura.",
  "mobile.shiftOpen.mapFailed":
    "No se pudo preparar el mapa. Conservamos el avance. Revisa la conexión y vuelve a intentar.",
  "mobile.shiftOpen.mapIncomplete":
    "Faltan archivos verificados o cobertura. Vuelve a preparar el mapa antes de salir.",
  "mobile.shiftOpen.mapProgress": "Avance de preparación (%):",
  "mobile.shiftOpen.recordSevere": "Guardar falla grave · No salir",
  "mobile.shiftOpen.severe":
    "No puedes salir con esta moto. Guarda la falla grave y avisa a tu supervisor para que gestione la liberación de flota. Guardarla no confirma que el servidor la recibió.",
  "mobile.shiftOpen.editChecklist": "Volver a elegir moto y revisar",
  "mobile.shiftOpen.motorcycle":
    "Confirma el código de la moto. Si la copia local indica un bloqueo, pide ayuda a tu supervisor.",
  "mobile.shiftOpen.checklist": "Contesta todos los puntos de seguridad antes de continuar.",
  "mobile.shiftOpen.noteGate": "Describe la falla grave o el motivo de Otro antes de guardar.",
  "mobile.shiftOpen.photo":
    "El catálogo exige una foto. Captúrala antes de salir; en esta versión no hay cámara disponible.",
  "mobile.shiftOpen.odometer":
    "Escribe los kilómetros como un número entero. Conservamos lo que escribiste.",
  "mobile.shiftOpen.map":
    "La salida requiere un mapa con archivos verificados y cobertura completa. Vuelve a intentar la preparación.",
  "mobile.shiftOpen.rejected":
    "El servidor rechazó la apertura. Revisa el resultado en Envíos y consulta a tu supervisor antes de salir.",
  "mobile.shiftOpen.phoneSaved": "Guardado en el teléfono · Recepción del servidor pendiente",
  "mobile.shiftOpen.serverReceived": "Recibido por el servidor · Consulta el resultado",
  "mobile.shiftOpen.reviewPending":
    "Revisión posterior: sin confirmación de resolución en esta versión.",
  "mobile.shiftOpen.correctAndRetry": "Corregir e intentar de nuevo",
  "mobile.shiftOpen.retrySave": "Reintentar guardar los datos",

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
    "Este teléfono tiene registros de otra cuenta. Llama a tu supervisor antes de cambiar de usuario.",
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
