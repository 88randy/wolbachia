/** Mexican Spanish messages of the `mobile` area (courier app shell and sync inbox). Source of the `mobile.*` key list. */
import type { AreaCatalog } from "../area.ts";

export const mobile = {
  "mobile.ovitrap.pendingDraft":
    "Ya tienes un borrador de otra captura. Continúa ese borrador antes de cambiar de ovitrampa.",
  // M-08: P13, P14 and P21
  "mobile.ovitrap.open": "Colocar o revisar ovitrampas",
  "mobile.ovitrap.place": "Colocar ovitrampa",
  "mobile.ovitrap.check": "Revisar ovitrampa",
  "mobile.ovitrap.next": "Continuar",
  "mobile.ovitrap.save": "Guardar en el teléfono",
  "mobile.ovitrap.point": "Elige un punto de tu asignación",
  "mobile.ovitrap.finding": "¿Cómo la encontraste?",
  "mobile.ovitrap.paddle": "¿Todavía tiene papeleta?",
  "mobile.ovitrap.eggs": "¿Tiene huevos?",
  "mobile.ovitrap.yes": "Sí",
  "mobile.ovitrap.no": "No",
  "mobile.ovitrap.conditions": "Condiciones del sitio",
  "mobile.ovitrap.temperature": "Temperatura (°C, opcional)",
  "mobile.ovitrap.humidity": "Humedad (%, opcional)",
  "mobile.ovitrap.paddleType": "Tipo de papeleta",
  "mobile.ovitrap.other": "Especifica qué encontraste (obligatorio para Otro)",
  "mobile.ovitrap.bag": "Código humano de la bolsa",
  "mobile.ovitrap.scanBag": "Escanear bolsa",
  "mobile.ovitrap.bagHint":
    "Una bolsa por lectura. Escribe el folio y la fecha; dobla hacia dentro. El laboratorio cuenta los huevos.",
  "mobile.ovitrap.lagged": "Marcar lectura desfasada",
  "mobile.ovitrap.laggedHint":
    "La papeleta desfasada sí va al laboratorio y se puede contar. El servidor determina su exclusión de los índices.",
  "mobile.ovitrap.prepare": "Preparar y reinstalar",
  "mobile.ovitrap.clean": "Lavé y tallé el bote",
  "mobile.ovitrap.water": "Agua limpia a tres cuartas partes, sin cloro ni larvicida",
  "mobile.ovitrap.liner": "Papeleta cubre todo el interior",
  "mobile.ovitrap.shade": "A la sombra, entre plantas",
  "mobile.ovitrap.height": "Hasta 1.5 m de altura",
  "mobile.ovitrap.containers": "Lejos de otros recipientes con agua",
  "mobile.ovitrap.safe": "Fuera del alcance de niños y animales",
  "mobile.ovitrap.marked": "Marqué la fachada con OV y el folio",
  "mobile.ovitrap.newPaddle": "Papeleta nueva",
  "mobile.ovitrap.reuse": "Papeleta reutilizada autorizada",
  "mobile.ovitrap.reuseUnavailable":
    "Solo se ofrece reutilización con elegibilidad descargada. Nunca una tercera reutilización.",
  "mobile.ovitrap.supplies": "Referencias UUID de insumos, separadas por coma",
  "mobile.ovitrap.photo": "Agregar evidencia fotográfica",
  "mobile.ovitrap.photoUnavailable":
    "La cámara de evidencia no está disponible en esta compilación. Conserva el borrador y pide ayuda si el catálogo requiere foto.",
  "mobile.ovitrap.refresh": "Descargar catálogos y reglas",
  "mobile.ovitrap.adopt": "Revisar y usar las versiones descargadas",
  "mobile.ovitrap.catalogChanged":
    "Hay un catálogo nuevo. Conservamos tus respuestas y etiquetas históricas; revisa antes de cambiar de versión.",
  "mobile.ovitrap.confirm": "Revisa antes de guardar",
  "mobile.ovitrap.phoneSaved": "Guardado en el teléfono",
  "mobile.ovitrap.serverPending": "Recepción del servidor: pendiente",
  "mobile.ovitrap.serverReceived": "Recibido por el servidor",
  "mobile.ovitrap.reviewPending": "Revisión: pendiente; pide ayuda a tu supervisor",
  "mobile.ovitrap.reviewUnknown": "Revisión del supervisor: sin confirmación",
  "mobile.ovitrap.repeat":
    "Ya registraste esta ovitrampa en la misma semana. Puedes anular con motivo y registrar una lectura nueva. La evidencia original se conserva.",
  "mobile.ovitrap.correct": "Anular con motivo y registrar nueva",
  "mobile.ovitrap.reason": "Motivo: de 10 caracteres visibles a 1000 caracteres",
  "mobile.ovitrap.reasonCode": "Motivo del catálogo",
  "mobile.ovitrap.newBag":
    "Usa un código de bolsa nuevo: los códigos anteriores quedan reservados.",
  "mobile.ovitrap.scan": "Escanear ovitrampa",
  "mobile.ovitrap.manual": "Escribir código manualmente",
  "mobile.ovitrap.manualHint":
    "La captura manual queda marcada. Usa el UUID físico de la ovitrampa o el código humano de la bolsa.",
  "mobile.ovitrap.code": "Código",
  "mobile.ovitrap.lookup": "Usar código",
  "mobile.ovitrap.invalid": "Este código no es válido para esta operación",
  "mobile.ovitrap.invalidHint":
    "Busca la etiqueta correcta del programa y vuelve a intentar, o escribe el código manualmente.",
  "mobile.ovitrap.retry": "Escanear de nuevo",
  "mobile.ovitrap.scannerUnavailable":
    "El escáner no está disponible en esta compilación. Escribe el código manualmente.",
  "mobile.ovitrap.gps":
    "La ubicación falta o su precisión no cumple las reglas descargadas. Intenta obtener GPS o guarda para revisión si la política lo permite.",
  "mobile.ovitrap.stale":
    "Las reglas cambiaron o vencieron. Descarga la versión vigente o conserva la captura para revisión si la política lo permite.",
  "mobile.ovitrap.distance":
    "Estás lejos del punto según las reglas descargadas. Acércate o conserva la captura para revisión.",
  "mobile.ovitrap.location":
    "No conocemos el punto de esta ovitrampa en el teléfono. El servidor revisará ubicación y alcance; no confirmamos cumplimiento.",
  "mobile.ovitrap.acknowledge": "Entiendo que la captura requiere revisión del servidor",
  "mobile.ovitrap.retryGps": "Intentar GPS de nuevo",
  "mobile.ovitrap.shiftBlocked":
    "La jornada no permite capturar ni guardar. Revisa la apertura con tu supervisor; el borrador se conserva.",
  "mobile.ovitrap.staleWeekContext":
    "Falta la configuraci?n vigente de semana y zona horaria de la organizaci?n. Actualiza el contexto antes de guardar; el borrador se conserva.",
  "mobile.ovitrap.immutableEdit":
    "El registro ya est? guardado y no admite cambios. Tu texto pendiente se conserva; revisa el registro y usa una correcci?n.",
  "mobile.ovitrap.gateShift": "Abre una jornada antes de guardar. El borrador se conserva.",
  "mobile.ovitrap.gateAssignment":
    "Falta la asignación con alcance explícito y semana epidemiológica. Descárgala antes de guardar.",
  "mobile.ovitrap.gateCatalog": "Falta el catálogo. Descárgalo antes de guardar.",
  "mobile.ovitrap.gateRules": "Faltan reglas utilizables. Descárgalas antes de guardar.",
  "mobile.ovitrap.gatePoint": "Elige un punto permitido y verifica las referencias de insumos.",
  "mobile.ovitrap.gateFinding": "Elige un hallazgo del catálogo guardado.",
  "mobile.ovitrap.gatePaddle": "Confirma la presencia y el tipo de papeleta.",
  "mobile.ovitrap.gateEggs": "Confirma Sí o No: ¿tiene huevos?",
  "mobile.ovitrap.gateBag": "Escribe el código humano de la bolsa.",
  "mobile.ovitrap.gateConditions":
    "Revisa temperatura y humedad. La humedad debe estar entre 0 y 100 %.",
  "mobile.ovitrap.gateOther": "Otro requiere una descripción de hasta 1000 caracteres.",
  "mobile.ovitrap.gatePrepare": "Completa la preparación antes de guardar.",
  "mobile.ovitrap.gateEvidence":
    "Este catálogo requiere evidencia fotográfica. Conserva el borrador y pide ayuda.",
  "mobile.ovitrap.gateReuse":
    "Esta papeleta no tiene una reutilización autorizada. Elige una nueva.",
  "mobile.ovitrap.gateReason":
    "Elige un motivo y escribe al menos 10 caracteres visibles, hasta 1000.",
  "mobile.ovitrap.gateReview":
    "Revisa los avisos de GPS y reglas. Solo puedes guardar para revisión cuando la política descargada lo permite.",
  "mobile.ovitrap.resume": "Continuar borrador",
  "mobile.ovitrap.nextTarget": "Siguiente punto",
  "mobile.ovitrap.edit": "Volver a revisar respuestas",
  "mobile.ovitrap.permission":
    "Consulta a tu supervisor para reemplazar, reubicar o retirar esta ovitrampa. Conserva esta lectura.",
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
