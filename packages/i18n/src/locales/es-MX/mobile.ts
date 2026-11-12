/** Mexican Spanish messages of the `mobile` area (courier app shell and sync inbox). Source of the `mobile.*` key list. */
import type { AreaCatalog } from "../area.ts";

export const mobile = {
  "mobile.sample.title": "Muestra de Wolbachia",
  "mobile.sample.subtitle": "Captura y entrega al laboratorio",
  "mobile.sample.loading": "Consultando tus muestras guardadas…",
  "mobile.sample.refresh": "Actualizar datos de captura",
  "mobile.sample.source": "Elige la fuente de la muestra",
  "mobile.sample.sourceReading": "Lectura de ovitrampa",
  "mobile.sample.sourceLot": "Lote",
  "mobile.sample.sourceRelease": "Liberación",
  "mobile.sample.noSources":
    "No hay fuentes disponibles en tu copia descargada. Actualiza o consulta a tu supervisor.",
  "mobile.sample.origin": "¿De dónde viene la muestra?",
  "mobile.sample.noOrigins": "No hay orígenes configurados disponibles. Consulta al administrador.",
  "mobile.sample.method": "Método verificado",
  "mobile.sample.noMethods": "No hay métodos verificados disponibles. Consulta al administrador.",
  "mobile.sample.selected": "Seleccionado",
  "mobile.sample.identity": "Identificador de la muestra",
  "mobile.sample.unavailable": "No disponible",
  "mobile.sample.code": "Código de la muestra",
  "mobile.sample.codeHint":
    "Escribe el código del recipiente, de hasta 50 caracteres. La oficina comprueba que sea único.",
  "mobile.sample.codeRequired": "Escribe un código de hasta 50 caracteres.",
  "mobile.sample.otherText": "Especifica el otro origen",
  "mobile.sample.otherHint": "Describe el origen de la muestra, de hasta 1000 caracteres.",
  "mobile.sample.otherRequired": "Describe el otro origen antes de guardar.",
  "mobile.sample.gps": "Precisión de la ubicación (m)",
  "mobile.sample.acquireGps": "Obtener ubicación",
  "mobile.sample.photo": "Evidencia fotográfica",
  "mobile.sample.photoUnknown": "Elige un origen para conocer el requisito de foto.",
  "mobile.sample.photoUnavailable":
    "No pudimos abrir la cámara. Conserva tus datos e intenta de nuevo.",
  "mobile.sample.photoRequired": "Este origen requiere una foto.",
  "mobile.sample.photoOptional": "Para este origen la foto es opcional.",
  "mobile.sample.photoPreview": "Foto privada de la muestra",
  "mobile.sample.takePhoto": "Tomar foto",
  "mobile.sample.undoPhoto": "Deshacer última foto",
  "mobile.sample.savedCaptures": "Muestras guardadas en este teléfono",
  "mobile.sample.draftStatus": "Borrador en el teléfono",
  "mobile.sample.deliveryPending": "Entrega al laboratorio sin confirmar",
  "mobile.sample.beginHint":
    "Elige una fuente real de tu copia descargada. El identificador QR por sí solo no confirma su origen ni autorización.",
  "mobile.sample.begin": "Preparar muestra",
  "mobile.sample.save": "Guardar muestra",
  "mobile.sample.saveHint":
    "Los datos se guardan en este teléfono y se envían con señal. Guardar no confirma recepción en laboratorio.",
  "mobile.sample.pendingEdits":
    "Guardando los últimos cambios. Si no terminan, conserva tus datos y usa Reintentar.",
  "mobile.sample.working": "Procesando…",
  "mobile.sample.blockedHint":
    "Completa los campos pendientes. Si faltan requisitos descargados, actualiza o consulta a tu supervisor. No hay una opción para omitirlos.",
  "mobile.sample.phoneSaved": "Muestra guardada en el teléfono. El envío sigue pendiente.",
  "mobile.sample.serverReceived": "La oficina recibió el registro de la muestra.",
  "mobile.sample.inReview":
    "El registro está en revisión. Esto no confirma una muestra operativa ni recepción en laboratorio.",
  "mobile.sample.rejected":
    "La oficina rechazó el registro. Tus datos y fotos se conservan; revisa Envíos y consulta a tu supervisor.",
  "mobile.sample.evidencePending": "La evidencia privada sigue pendiente de verificación.",
  "mobile.sample.reviewApplied":
    "Se observó una revisión aplicada. El estado original del envío se conserva.",
  "mobile.sample.reviewDiscarded":
    "Se observó el descarte en revisión. La captura original se conserva.",
  "mobile.sample.reviewObserved": "Hay una decisión posterior de revisión. Consulta Envíos.",
  "mobile.sample.inbox": "Ver envíos",
  "mobile.sample.backToDay": "Volver al día",
  "mobile.sample.deliver": "Entrega el recipiente al laboratorio al cerrar jornada.",
  "mobile.sample.receiptUnknown":
    "No hay una recepción confirmada en los datos descargados. El recordatorio se conserva.",
  "mobile.sample.received":
    "Hay una recepción de laboratorio confirmada para esta muestra y este registro.",
  "mobile.sample.noResultAssumption":
    "La recepción no es un resultado. Un resultado ausente, inválido o en disputa no significa negativo.",
  "mobile.sample.storageError":
    "No pudimos guardar los cambios. Tus campos se conservan; usa Reintentar.",
  "mobile.sample.scopeUnavailable":
    "Tu acceso o contexto cambió. Desbloquea y actualiza para continuar.",
  "mobile.sample.shiftRequired": "Necesitas una jornada abierta para capturar una muestra.",
  "mobile.sample.configurationUnavailable":
    "Faltan requisitos originales o actuales de origen y método. Actualiza o consulta al administrador.",
  "mobile.sample.sourceUnavailable":
    "La fuente original ya no está disponible o no corresponde a esta captura. Consulta a tu supervisor.",
  "mobile.sample.originRequired": "Elige un origen disponible.",
  "mobile.sample.methodRequired": "Elige una versión de método verificada disponible.",
  "mobile.sample.gpsRequired": "Obtén una ubicación antes de guardar.",
  "mobile.sample.evidenceRequired": "Agrega la foto requerida por el origen antes de guardar.",
  "mobile.sample.staleDraft":
    "Este borrador ya cambió. Recupera su estado actual antes de continuar.",
  "mobile.release.title": "Registrar liberación",
  "mobile.release.blockedTitle": "No puedes liberar",
  "mobile.release.subtitle": "Requisitos de la copia descargada",
  "mobile.release.loading": "Consultando los requisitos guardados en el teléfono…",
  "mobile.release.chooseTask": "Elige la tarea de liberación",
  "mobile.release.chooseDevice": "Elige el dispositivo de liberación",
  "mobile.release.emptyTask":
    "No hay tareas disponibles en tu copia descargada. Consulta a tu supervisor.",
  "mobile.release.emptyDevice":
    "No hay dispositivos disponibles para esta selección. Consulta a tu supervisor.",
  "mobile.release.selectionHint":
    "Las opciones vienen de tu copia descargada. El registro conserva la tarea, el dispositivo y sus versiones originales.",
  "mobile.release.selectedChoice": "Seleccionado",
  "mobile.release.begin": "Preparar esta captura",
  "mobile.release.restart": "Iniciar otro borrador con los requisitos actualizados",
  "mobile.release.restartHint":
    "El borrador y su evidencia originales se conservan. El nuevo borrador sólo copia la cantidad; necesita su propia ubicación, fotos y comprobaciones. Esto no aprueba la captura anterior.",
  "mobile.release.beginHint":
    "Elige la tarea y el dispositivo para abrir o recuperar su captura en el teléfono. Los requisitos se vuelven a comprobar antes de guardar.",
  "mobile.release.draftPending":
    "Guardando los últimos cambios en el teléfono. Si no terminan, conserva tus datos y usa Reintentar.",
  "mobile.release.staleDraft":
    "Esta captura cambió o perdió autorización. Conserva tus datos y vuelve a consultar la copia descargada.",
  "mobile.release.shiftRequired":
    "Necesitas una jornada abierta en este teléfono. Vuelve al inicio para revisarla.",
  "mobile.release.safetyBlocked":
    "Falta un requisito de seguridad. Revisa los renglones marcados; no hay opción de omitirlos.",
  "mobile.release.photoUnavailable":
    "No pudimos obtener la foto. Tus datos se conservan; revisa el permiso de cámara y vuelve a intentarlo.",
  "mobile.release.reviewApplied":
    "Se registró una revisión aplicada a esta declaración. La respuesta original de la oficina se conserva.",
  "mobile.release.reviewDiscarded":
    "La revisión descartó esta declaración. La evidencia y la respuesta original se conservan.",
  "mobile.release.reviewObserved":
    "Hay una revisión vinculada con esta declaración. Consulta su resultado en Envíos.",
  "mobile.release.prerequisites": "Requisitos para liberar",
  "mobile.release.gatePermit": "Permiso vigente",
  "mobile.release.gateZone": "Zona oficial autorizada",
  "mobile.release.gateLot": "Lote y existencia disponibles",
  "mobile.release.gateTraining": "Capacitación vigente",
  "mobile.release.gateSchedule": "Programación autorizada",
  "mobile.release.gateGps": "Ubicación con precisión suficiente",
  "mobile.release.gateDevice": "Dispositivo de liberación activo",
  "mobile.release.gateConfiguration": "Configuración de captura disponible",
  "mobile.release.pass": "Comprobado",
  "mobile.release.fail": "No cumple",
  "mobile.release.unavailable": "No disponible; liberación bloqueada",
  "mobile.release.contactSupervisor": "Pide a tu supervisor que revise este requisito.",
  "mobile.release.contactAdmin": "Pide al administrador que revise la configuración.",
  "mobile.release.contactCourier":
    "Obtén una ubicación precisa en un lugar seguro y vuelve a revisar.",
  "mobile.release.noBypass":
    "No liberes mientras falte un requisito. Desde aquí no hay forma de omitirlo.",
  "mobile.release.cachedOnly":
    "Esta comprobación usa la copia descargada. La oficina vuelve a revisar al recibirla.",
  "mobile.release.deviceId": "Dispositivo de liberación",
  "mobile.release.taskId": "Tarea programada",
  "mobile.release.permitId": "Permiso",
  "mobile.release.lotId": "Lote de origen",
  "mobile.release.referenceUnavailable": "Sin información comprobada",
  "mobile.release.detailQuantityInvalid":
    "Registra una cantidad mayor que cero, con hasta 14 dígitos enteros y 6 decimales.",
  "mobile.release.detailStockUnavailable":
    "La cantidad supera la existencia recibida disponible, incluida la reservada por otros registros del teléfono.",
  "mobile.release.detailLotBlocked":
    "El lote o su política de traslado tienen un bloqueo. No liberes; consulta a tu supervisor.",
  "mobile.release.detailLotExpired":
    "El lote no está vigente para esta captura. No liberes; consulta a tu supervisor.",
  "mobile.release.detailDeviceBlocked":
    "El dispositivo está inactivo o retirado. No lo uses para liberar; avisa a tu supervisor.",
  "mobile.release.detailScheduleBlocked":
    "La tarea ya fue usada o cambió su programación, permiso o responsable. No liberes con esta captura.",
  "mobile.release.detailEvidenceRequired":
    "Toma la foto de evidencia que requiere esta liberación antes de guardar.",
  "mobile.release.detailPinsChanged":
    "Cambió una referencia original de seguridad, equipo o existencia. Conserva la captura y consulta a tu supervisor.",
  "mobile.release.detailTrainingPinInvalid":
    "La capacitación declarada no está vigente en ambas comprobaciones. No liberes; consulta a tu supervisor.",
  "mobile.release.detailPermitUnavailable": "Falta el permiso oficial en la copia descargada.",
  "mobile.release.detailPermitBlocked":
    "El permiso tiene un bloqueo o una suspensión. No liberes; consulta a tu supervisor.",
  "mobile.release.detailPermitExpired":
    "El permiso no está vigente para esta captura. No liberes; consulta a tu supervisor.",
  "mobile.release.detailZoneUnavailable":
    "No está disponible la geometría oficial del permiso para comprobar esta ubicación.",
  "mobile.release.detailZoneOutside":
    "La ubicación está fuera de la zona oficial autorizada. No liberes en este lugar.",
  "mobile.release.detailGpsUnavailable":
    "Falta una ubicación válida y precisa. Obtén la ubicación en un lugar seguro.",
  "mobile.release.detailGpsAccuracy":
    "La precisión de la ubicación no cumple el límite configurado. Vuelve a obtener la ubicación.",
  "mobile.release.detailTrainingUnavailable":
    "No se pudo comprobar tu capacitación para esta liberación.",
  "mobile.release.detailTrainingBlocked":
    "La capacitación descargada no permite esta liberación. Pide a tu supervisor que la revise.",
  "mobile.release.detailScheduleUnavailable":
    "No se pudo comprobar una tarea autorizada vinculada con este permiso.",
  "mobile.release.detailLotUnavailable":
    "No se pudo comprobar la seguridad del lote y su existencia recibida para esta liberación.",
  "mobile.release.detailDeviceUnavailable":
    "No se pudo comprobar el dispositivo y su lote de origen en la copia descargada.",
  "mobile.release.detailConfigurationUnavailable":
    "Falta la configuración comprobada para registrar esta liberación.",
  "mobile.release.detailScopeUnavailable":
    "La copia descargada no autoriza esta captura. Conserva el registro y consulta a tu supervisor.",
  "mobile.release.detailContractUnavailable":
    "Faltan datos de seguridad que deben llegar al teléfono. No liberes; consulta a tu supervisor.",
  "mobile.release.quantity": "Cantidad estimada",
  "mobile.release.quantityHint":
    "Registra la cantidad observada. La cantidad planeada no confirma existencia ni autorización.",
  "mobile.release.gpsAccuracy": "Precisión de ubicación, en metros",
  "mobile.release.acquireGps": "Obtener ubicación",
  "mobile.release.evidence": "Fotos de evidencia",
  "mobile.release.evidenceRequired":
    "La configuración requiere evidencia fotográfica antes de guardar.",
  "mobile.release.evidenceOptional": "La configuración permite guardar sin foto.",
  "mobile.release.evidenceUnknown":
    "No se pudo comprobar el requisito de evidencia. No liberes; consulta a tu supervisor.",
  "mobile.release.photoPreview": "Vista previa de la foto de liberación",
  "mobile.release.capturePhoto": "Tomar foto",
  "mobile.release.undoPhoto": "Deshacer última foto",
  "mobile.release.phoneSaved": "Guardada en el teléfono. Todavía no hay recepción en la oficina.",
  "mobile.release.serverReceived":
    "La oficina recibió el registro. Consulta por separado su resultado de revisión.",
  "mobile.release.inReview":
    "La oficina recibió el registro para revisión. Esto no confirma una liberación autorizada.",
  "mobile.release.criticalRejected":
    "La oficina rechazó la liberación por seguridad. La evidencia se conserva; avisa a tu supervisor. No hay opción de aprobarla desde aquí.",
  "mobile.release.evidencePending":
    "Las fotos siguen pendientes de envío o verificación. El registro permanece guardado en el teléfono.",
  "mobile.release.openInbox": "Ver en Envíos",
  "mobile.release.saveHint":
    "Guardar conserva el registro en el teléfono; no confirma autorización de la oficina.",
  "mobile.release.working": "Procesando en el teléfono…",
  "mobile.release.save": "Guardar registro de liberación",
  "mobile.release.reportDevice": "Reportar dispositivo dañado",
  "mobile.release.reportSupervisor": "Reportar al supervisor",
  "mobile.release.backToDay": "Volver al día",
  "mobile.scanner.title": "Escanear código",
  "mobile.scanner.hint": "Apunta al código QR del programa.",
  "mobile.scanner.start": "Usar cámara",
  "mobile.scanner.manual": "Escribir código",
  "mobile.scanner.code": "Código impreso debajo del QR",
  "mobile.scanner.lookup": "Buscar código",
  "mobile.scanner.torchOn": "Encender linterna",
  "mobile.scanner.torchOff": "Apagar linterna",
  "mobile.scanner.denied":
    "La app no puede usar la cámara. Actívala en Ajustes del teléfono › Permisos › Cámara, o escribe el código.",
  "mobile.scanner.settings": "Abrir ajustes del teléfono",
  "mobile.scanner.cameraFailed":
    "No pudimos abrir la cámara. Intenta de nuevo o escribe el código impreso.",
  "mobile.scanner.damaged":
    "Si el código no se lee, limpia la etiqueta, enciende la linterna o escribe el código impreso.",
  "mobile.scanner.retry": "Escanear de nuevo",
  "mobile.scanner.resume": "Continuar captura guardada en el teléfono",
  "mobile.scanner.loading": "Buscando en la copia descargada…",
  "mobile.scanner.report": "Reportar daño o caducidad",
  "mobile.scanner.invalid":
    "No pudimos reconocer este código. Busca la etiqueta del programa o escribe el código impreso.",
  "mobile.scanner.version":
    "Esta versión de código no es compatible. Escribe el código impreso o consulta a tu supervisor.",
  "mobile.scanner.kind":
    "Este tipo de código no corresponde a esta captura. Escanea la etiqueta solicitada o escribe su código.",
  "mobile.scanner.unavailable":
    "Este registro no está disponible en tu copia descargada. Escanea otro código o consulta a tu supervisor.",
  "mobile.scanner.retired":
    "Esta ovitrampa está retirada. Escanea otra etiqueta o avisa a tu supervisor si la encontraste en campo.",
  "mobile.scanner.duplicate":
    "Ya se leyó este código. Puedes continuar la captura o escanear de nuevo; no se agregó otro registro.",
  "mobile.scanner.storage":
    "No pudimos guardar el cambio en el teléfono. Conserva tu captura e intenta de nuevo.",
  "mobile.scanner.supplyTitle": "Detalle de insumo",
  "mobile.scanner.lot": "Identificador del lote",
  "mobile.scanner.quantity": "Cantidad prevista en el plan descargado",
  "mobile.scanner.unit": "Identificador de la versión de unidad",
  "mobile.scanner.assignment": "Asignación de origen",
  "mobile.scanner.date": "Fecha de la asignación",
  "mobile.scanner.revision": "Versión de tu plan",
  "mobile.scanner.sourceLine": "Línea del plan",
  "mobile.scanner.missingMetadata":
    "La copia descargada no incluye nombres de insumo o unidad, código impreso del lote ni caducidad. Esta cantidad es del plan; no confirma recepción ni existencias. Consulta la etiqueta o a tu supervisor.",
  "mobile.shiftClose.refreshSupplies": "Actualizar recepciones descargadas",
  "mobile.shiftClose.sourceFrame":
    "Esto es lo que la oficina confirmó. Lo que declaraste va abajo.",

  "mobile.shiftClose.title": "Cerrar jornada",
  "mobile.shiftClose.closedTitle": "Jornada cerrada",
  "mobile.shiftClose.phoneClosed": "Cerrada en el teléfono",
  "mobile.shiftClose.serverReceived": "La oficina recibió los registros de cierre",
  "mobile.shiftClose.inReview": "La oficina recibió un registro para revisión",
  "mobile.shiftClose.rejected":
    "Un registro fue rechazado. Revisa Envíos; la jornada sigue cerrada en el teléfono.",
  "mobile.shiftClose.pending": "Puntos pendientes",
  "mobile.shiftClose.noPending": "No hay puntos pendientes en la copia descargada.",
  "mobile.shiftClose.goNow": "Ir al día",
  "mobile.shiftClose.leavePending": "Cerrar sin completar este punto",
  "mobile.shiftClose.leftPending": "Confirmado: el punto queda pendiente",
  "mobile.shiftClose.planned": "Asignado por almacén",
  "mobile.shiftClose.equation": "Recibido ? usado ? devuelto ? merma",
  "mobile.shiftClose.difference": "Diferencia",
  "mobile.shiftClose.unknown": "Sin dato confirmado",
  "mobile.shiftClose.supplies": "Conciliación de insumos",
  "mobile.shiftClose.differenceAllowed":
    "Las diferencias quedan para revisión y no impiden cerrar. La devolución es una declaración; almacén confirma su recepción.",
  "mobile.shiftClose.suppliesUnavailable":
    "No hay una recepción descargada vinculada a esta jornada. Los saldos y la conciliación quedan sin confirmar; puedes cerrar.",
  "mobile.shiftClose.returnQuantity": "Cantidad adicional que devuelves",
  "mobile.shiftClose.returnDestination": "Devolución al almacén de origen",
  "mobile.shiftClose.odometer": "Odómetro al cerrar (km)",
  "mobile.shiftClose.note": "Nota de cierre (opcional)",
  "mobile.shiftClose.lowOdometer":
    "El odómetro es menor que al abrir. Se conservará para revisión; puedes cerrar en el teléfono.",
  "mobile.shiftClose.confirmTitle": "¿Cerrar la jornada?",
  "mobile.shiftClose.confirmHint":
    "Se guardará en este teléfono y dejarás de capturar y recopilar ubicación en esta jornada. Los puntos pendientes no se completarán.",
  "mobile.shiftClose.close": "Cerrar jornada en el teléfono",
  "mobile.shiftClose.continue": "Revisar y confirmar cierre",
  "mobile.shiftClose.retryHint":
    "Lo pendiente se reintentará al recuperar la sesión y la conexión. No desinstales la app. Los adjuntos pendientes y los rechazos se consultan en Envíos.",
  "mobile.shiftClose.reviewHistory": "Historial de revisión",
  "mobile.shiftClose.notReviewed": "Sin decisión de supervisor descargada.",
  "mobile.shiftClose.observed": "Observada por supervisor",
  "mobile.shiftClose.approved": "Aprobación vigente",
  "mobile.shiftClose.staleApproval": "Aprobación anterior; requiere nueva revisión",
  "mobile.shiftClose.noShift": "No hay una jornada local para cerrar. Vuelve al inicio.",
  "mobile.shiftClose.saveFailed":
    "No se guardó el cambio. Conservamos tus entradas. Revisa los pendientes, cantidades y motivos, y vuelve a intentar; si continúa, revisa el almacenamiento con tu supervisor.",
  "mobile.shiftClose.shrinkageQuantity": "Cantidad adicional de merma",
  "mobile.shiftClose.reason": "Motivo de merma (10 a 1000 caracteres)",
  "mobile.shiftClose.photo": "Tomar foto de merma",
  "mobile.shiftClose.photoRequired": "La merma requiere una foto y un motivo de la lista.",
  "mobile.shiftClose.photoSaved": "Foto guardada en el teléfono; pendiente de entrega",
  "mobile.shiftOpen.closed": "La jornada está cerrada en este teléfono. Consulta su resumen.",

  "mobile.unlock.greetingNeutral": "Hola",
  "mobile.shiftOpen.severeSaved":
    "No puedes salir con esta moto por una falla grave. Avisa a tu supervisor para que gestione la liberación de flota.",
  "mobile.shiftOpen.receivedRejected": "La oficina no aceptó tu apertura. Avisa a tu supervisor.",
  "mobile.shiftOpen.receivedInReview": "La oficina está revisando tu apertura.",
  "mobile.preview.title": "Vista de estilos",
  "mobile.preview.sample": "Ejemplo",
  "mobile.preview.intro":
    "Ejemplos de interfaz sin datos reales. No guardan cambios ni envían registros.",
  "mobile.preview.themeHint": "Sigue el teléfono o elige una apariencia.",
  "mobile.preview.textScaleHint":
    "Para revisar texto al 130 %, usa el tamaño de texto del teléfono.",
  "mobile.preview.system": "Sistema",
  "mobile.preview.light": "Claro",
  "mobile.preview.dark": "Oscuro",
  "mobile.preview.toggleTheme": "Cambiar apariencia",
  "mobile.preview.primary": "Terminar revisión",
  "mobile.preview.data": "Datos de ejemplo",
  "mobile.preview.progress": "Puntos revisados · meta del día",
  "mobile.preview.received": "Recibido",
  "mobile.preview.onPhone": "En el teléfono",
  "mobile.preview.problem": "Con problema",
  "mobile.preview.review": "En revisión",
  "mobile.preview.inactive": "Sin actividad",
  "mobile.preview.fields": "Captura",
  "mobile.preview.code": "Código de ejemplo",
  "mobile.preview.disabled": "Acción no disponible",
  "mobile.preview.disabledHint":
    "Ejemplo: falta una configuración. Tu supervisor puede habilitar esta acción.",
  "mobile.preview.loading": "Cargando en el teléfono",
  "mobile.preview.empty": "Aún sin registros",
  "mobile.preview.partial": "El resto sigue disponible",
  "mobile.preview.error":
    "No se pudo actualizar este ejemplo. Reintenta; lo que capturaste sigue aquí.",
  "mobile.preview.retryResult": "Reintento de ejemplo completado. No se contactó a la oficina.",
  "mobile.lifecycle.replace": "Sustituir ovitrampa",
  "mobile.lifecycle.relocate": "Proponer reubicación",
  "mobile.lifecycle.remove": "Retirar ovitrampa",
  "mobile.lifecycle.fixedCode":
    "El folio del punto se conserva. La sustitución usa una nueva identidad física.",
  "mobile.lifecycle.source": "Ovitrampa de origen",
  "mobile.lifecycle.replacement": "Nueva identidad física",
  "mobile.lifecycle.proposalOnly":
    "Se guardará como propuesta. La ubicación autorizada del punto permanece igual hasta una decisión recibida.",
  "mobile.lifecycle.proposedLocation": "Ubicación propuesta (longitud, latitud)",
  "mobile.lifecycle.closedWeeks": "Semanas consecutivas con casa cerrada (regla descargada):",
  "mobile.lifecycle.confirmedCount": "Incidencias conocidas (regla descargada):",
  "mobile.lifecycle.noIncidentHistory":
    "Sin historial local de incidencias; no se calcula esa sugerencia.",
  "mobile.lifecycle.inspectHistory":
    "Revisa el historial antes de proponer. La sugerencia es orientativa.",
  "mobile.lifecycle.gpsRequired":
    "Falta GPS. Inténtalo de nuevo; no se puede guardar sin ubicación.",
  "mobile.lifecycle.gpsCaptured": "GPS capturado en el teléfono",
  "mobile.lifecycle.captureGps": "Capturar ubicación GPS",
  "mobile.lifecycle.recovery": "¿Recuperaste la ovitrampa? Elige una opción.",
  "mobile.lifecycle.recovered": "Recuperada: la llevo de regreso",
  "mobile.lifecycle.unrecovered": "No recuperada: no la encontr?",
  "mobile.lifecycle.unconfirmed": "Recuperación sin confirmar",
  "mobile.lifecycle.recoveryNotice":
    "La recuperación queda pendiente. Sin confirmar se conserva en el teléfono y se reporta como no recuperada a la oficina.",
  "mobile.lifecycle.reason": "Motivo descargado",
  "mobile.lifecycle.chooseReason": "Elegir motivo",
  "mobile.lifecycle.other": "Otro: describe el motivo (máximo 1000 caracteres)",
  "mobile.lifecycle.incidentNotice":
    "La oficina vinculará el hallazgo con una incidencia cuando aplique la captura. El teléfono no crea una incidencia.",
  "mobile.lifecycle.photoRequired": "Agrega al menos una foto de esta captura antes de guardar.",
  "mobile.lifecycle.capturePhoto": "Agregar foto de evidencia",
  "mobile.lifecycle.discardPhoto": "Quitar foto del borrador",
  "mobile.lifecycle.photoDiscarded": "Foto retirada del borrador. Puedes deshacerlo.",
  "mobile.lifecycle.undo": "Deshacer",
  "mobile.lifecycle.reviewAcknowledge":
    "Entiendo que el GPS, distancia o reglas desactualizadas requieren revisión de la oficina.",
  "mobile.lifecycle.download": "Actualizar listas y reglas de ciclo de vida",
  "mobile.lifecycle.adopt": "Revisar y usar las listas y reglas nuevas",
  "mobile.lifecycle.begin": "Iniciar captura para este punto",
  "mobile.lifecycle.loading": "Cargando borrador local?",
  "mobile.lifecycle.empty":
    "Inicia la captura desde la ovitrampa seleccionada. Si falta configuración, descárgala primero.",
  "mobile.lifecycle.confirmRemove": "Revisar y confirmar retiro",
  "mobile.lifecycle.removeConsequence":
    "El punto quedará sin esta ovitrampa. Para corregir se agrega una anulación con motivo; la evidencia se conserva.",
  "mobile.lifecycle.save": "Guardar en el teléfono",
  "mobile.lifecycle.incomplete":
    "Captura incompleta: revisa motivo, Otro, GPS, foto y recuperación. El borrador se conserva.",
  "mobile.lifecycle.proposed": "Propuesta",
  "mobile.lifecycle.approved": "Aprobada",
  "mobile.lifecycle.rejected": "Rechazada",
  "mobile.lifecycle.reviewAccepted":
    "Resultado de la oficina: aceptado. Revisión del supervisor: sin confirmación.",
  "mobile.lifecycle.reviewRejected":
    "Resultado de la oficina: rechazado. Conserva la evidencia y consulta al supervisor.",
  "mobile.lifecycle.decisionPending": "Decisión del supervisor: pendiente de enviar",
  "mobile.lifecycle.nextTask": "Tarea recibida",
  "mobile.lifecycle.noTask": "Sin tarea recibida; no hay asignación local anticipada.",
  "mobile.lifecycle.history": "Historial de ciclo de vida y correcciones",
  "mobile.lifecycle.voided": "Anulación registrada; se conserva el original",
  "mobile.lifecycle.correctionReason":
    "Motivo de corrección (de 10 caracteres visibles a 1000 caracteres)",
  "mobile.lifecycle.correct": "Anular con motivo conservando evidencia",
  "mobile.lifecycle.scopeBlocked":
    "Este punto ya no está en tu alcance descargado. El borrador se conserva; consulta al supervisor.",
  "mobile.lifecycle.noCamera":
    "La cámara no está disponible. Conserva el borrador e intenta de nuevo en un equipo habilitado.",
  "mobile.lifecycle.noReasons": "Falta la lista de motivos. Actualízala antes de continuar.",

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
    "La papeleta desfasada sí va al laboratorio y se puede contar. La oficina determina su exclusión de los índices.",
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
  "mobile.ovitrap.supplies": "Insumos usados (opcional)",
  "mobile.ovitrap.photo": "Agregar evidencia fotográfica",
  "mobile.camera.takeTitle": "Toma la foto",
  "mobile.camera.takeHint": "Apunta bien y toca el botón grande.",
  "mobile.camera.reviewTitle": "¿Se ve bien la foto?",
  "mobile.camera.reviewHint": "Si se ve bien, úsala. Si no, tómala otra vez.",
  "mobile.camera.previewLabel": "Foto que acabas de tomar",
  "mobile.camera.viewfinderLabel": "Vista de la cámara",
  "mobile.camera.shoot": "Tomar foto",
  "mobile.camera.waiting": "Esperando a que abra la cámara.",
  "mobile.camera.use": "Usar esta foto",
  "mobile.camera.retake": "Tomar otra vez",
  "mobile.camera.cancel": "Cancelar",
  "mobile.camera.failed": "No se pudo tomar la foto. Intenta otra vez.",
  "mobile.camera.undo": "Quitar esta foto del borrador",
  "mobile.ovitrap.concurrentEdit":
    "El borrador cambió mientras se guardaba. Tus cambios siguen pendientes; vuelve a intentar guardarlos.",
  "mobile.camera.ownerRequired":
    "Vuelve a iniciar sesión para confirmar la cuenta antes de tomar la foto. Tu borrador sigue en el teléfono.",
  "mobile.camera.fileType":
    "La foto tiene un formato no compatible. Vuelve a tomarla en JPEG o PNG; tu borrador sigue en el teléfono.",
  "mobile.camera.fileSize":
    "La foto no tiene un tamaño válido. Ajusta la resolución de la cámara y vuelve a tomarla; tu borrador sigue en el teléfono.",
  "mobile.camera.permissionDenied":
    "No se agregó una foto. Permite usar la cámara e inténtalo de nuevo; tu borrador sigue en el teléfono.",
  "mobile.camera.permissionBlocked":
    "La cámara está bloqueada. Habilítala en los ajustes de la aplicación o pide ayuda; tu borrador sigue en el teléfono.",
  "mobile.camera.resultInvalid":
    "La cámara no entregó una foto válida. Inténtalo de nuevo; tu borrador sigue en el teléfono.",
  "mobile.camera.busy": "Hay una captura en curso. Regresa de la cámara y vuelve a intentarlo.",
  "mobile.camera.unlockRequired":
    "Desbloquea la aplicación y vuelve a tomar la foto. Tu borrador sigue en el teléfono.",
  "mobile.camera.fileFailed":
    "No se pudo guardar la foto en el teléfono. Revisa el espacio disponible e intenta tomarla de nuevo; tu borrador sigue en el teléfono.",
  "mobile.ovitrap.photoUnavailable":
    "No se pudo abrir la cámara. Permite la cámara e inténtalo otra vez; tu borrador sigue en el teléfono.",
  "mobile.ovitrap.refresh": "Actualizar listas y reglas",
  "mobile.ovitrap.adopt": "Revisar y usar las versiones descargadas",
  "mobile.ovitrap.catalogChanged":
    "Hay una lista nueva. Conservamos tus respuestas y etiquetas históricas; revisa antes de cambiar de versión.",
  "mobile.ovitrap.confirm": "Revisa antes de guardar",
  "mobile.ovitrap.phoneSaved": "Guardado en el teléfono",
  "mobile.ovitrap.serverPending": "Recepción en la oficina: pendiente",
  "mobile.ovitrap.serverReceived": "Recibido en la oficina",
  "mobile.ovitrap.reviewPending": "Revisión: pendiente; pide ayuda a tu supervisor",
  "mobile.ovitrap.reviewUnknown": "Revisión del supervisor: sin confirmación",
  "mobile.ovitrap.repeat":
    "Ya registraste esta ovitrampa en la misma semana. Puedes anular con motivo y registrar una lectura nueva. La evidencia original se conserva.",
  "mobile.ovitrap.correct": "Anular con motivo y registrar nueva",
  "mobile.ovitrap.reason": "Motivo: de 10 caracteres visibles a 1000 caracteres",
  "mobile.ovitrap.reasonCode": "Motivo",
  "mobile.ovitrap.newBag":
    "Usa un código de bolsa nuevo: los códigos anteriores quedan reservados.",
  "mobile.ovitrap.scan": "Escanear ovitrampa",
  "mobile.ovitrap.manual": "Escribir código manualmente",
  "mobile.ovitrap.manualHint":
    "Escríbelo solo si no puedes escanear el código. Quedará marcado como escrito a mano.",
  "mobile.ovitrap.code": "Código",
  "mobile.ovitrap.lookup": "Usar código",
  "mobile.ovitrap.invalid": "Este código no es válido para esta operación",
  "mobile.ovitrap.invalidHint":
    "Busca la etiqueta correcta del programa y vuelve a intentar, o escribe el código manualmente.",
  "mobile.ovitrap.retry": "Escanear de nuevo",
  "mobile.ovitrap.scannerUnavailable":
    "El escáner no está disponible en esta versión. Escribe el código manualmente.",
  "mobile.ovitrap.gps":
    "La ubicación falta o su precisión no cumple las reglas descargadas. Intenta obtener GPS o guarda para revisión si la política lo permite.",
  "mobile.ovitrap.stale":
    "Las reglas cambiaron o vencieron. Descarga la versión vigente o conserva la captura para revisión si la política lo permite.",
  "mobile.ovitrap.distance":
    "Estás lejos del punto según las reglas descargadas. Acércate o conserva la captura para revisión.",
  "mobile.ovitrap.location":
    "No conocemos el punto de esta ovitrampa en el teléfono. La oficina revisará ubicación y alcance; no confirmamos cumplimiento.",
  "mobile.ovitrap.acknowledge": "Entiendo que la captura requiere revisión de la oficina",
  "mobile.ovitrap.retryGps": "Intentar GPS de nuevo",
  "mobile.ovitrap.shiftBlocked":
    "La jornada no permite capturar ni guardar. Revisa la apertura con tu supervisor; el borrador se conserva.",
  "mobile.ovitrap.staleWeekContext":
    "Falta la configuración vigente de semana y zona horaria de la organización. Actualiza el contexto antes de guardar; el borrador se conserva.",
  "mobile.ovitrap.staleView":
    "La captura que ves cambió. No se aplicó esta acción. Actualiza la vista y vuelve a intentarlo.",
  "mobile.ovitrap.immutableEdit":
    "La edición tardía no se guardó y se descartó. Inicia una nueva captura o usa una corrección.",
  "mobile.ovitrap.gateShift": "Abre una jornada antes de guardar. El borrador se conserva.",
  "mobile.ovitrap.gateAssignment":
    "Falta la asignación con alcance explícito y semana epidemiológica. Descárgala antes de guardar.",
  "mobile.ovitrap.gateCatalog": "Falta la lista. Actualízala antes de guardar.",
  "mobile.ovitrap.gateRules": "Faltan reglas utilizables. Descárgalas antes de guardar.",
  "mobile.ovitrap.gatePoint": "Elige un punto permitido y verifica las referencias de insumos.",
  "mobile.ovitrap.gateFinding": "Elige un hallazgo de la lista.",
  "mobile.ovitrap.gatePaddle": "Confirma la presencia y el tipo de papeleta.",
  "mobile.ovitrap.gateEggs": "Confirma Sí o No: ¿tiene huevos?",
  "mobile.ovitrap.gateBag": "Escribe el código humano de la bolsa.",
  "mobile.ovitrap.gateConditions":
    "Revisa temperatura y humedad. La humedad debe estar entre 0 y 100 %.",
  "mobile.ovitrap.gateOther": "Otro requiere una descripción de hasta 1000 caracteres.",
  "mobile.ovitrap.gatePrepare": "Completa la preparación antes de guardar.",
  "mobile.ovitrap.gateEvidence":
    "Esta lista requiere evidencia fotográfica. Conserva el borrador y pide ayuda.",
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
  // M-06: P9-P10 day list and offline map
  "mobile.day.loading": "Cargando puntos guardados…",
  "mobile.day.updating": "Actualizando…",
  "mobile.day.readFailed": "No pudimos leer los puntos guardados. Intenta leerlos otra vez.",
  "mobile.day.mapFailed": "No pudimos abrir el mapa guardado. Intenta de nuevo o usa la lista.",
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
  "mobile.day.progress": "{completed} de {total} tareas completadas",
  "mobile.day.pending": "Pendientes · Alto Riesgo primero",
  "mobile.day.closedSection": "Casas cerradas por volver hoy",
  "mobile.day.completedSection": "Tareas completadas",
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
  "mobile.day.doneStatus": "Completada",
  "mobile.day.closedStatus": "Casa cerrada · volver",
  "mobile.day.relocateStatus": "Por reubicar",
  "mobile.day.unknownStatus": "Estado por confirmar",
  "mobile.day.phoneSaved": "Guardado en el teléfono",
  "mobile.day.serverReceived": "Recibido en la oficina · revisión aparte",
  "mobile.day.receiptRejected": "Captura rechazada. Consulta el detalle en Envíos.",
  "mobile.day.captureInReview": "Captura en revisión de la oficina",
  "mobile.day.reviewUnconfirmed": "Revisión de la oficina sin confirmar",
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
  "mobile.day.accessRevoked":
    "Los puntos descargados ya no est\u00e1n disponibles. Actualiza la jornada.",
  "mobile.day.noLocation": "Este punto todav\u00eda no tiene ubicaci\u00f3n. Puedes usar la lista.",
  "mobile.day.noMap": "No tienes el mapa guardado",
  "mobile.day.noMapHint":
    "No hay un mapa guardado en el teléfono. Conéctate a internet y vuelve a intentar, o usa la lista de puntos.",
  "mobile.day.retryMap": "Intentar con el mapa otra vez",
  "mobile.day.outsideCoverage": "Fuera del área del mapa guardado",
  "mobile.day.attribution": "© OpenStreetMap contributors",
  "mobile.day.mapLabel": "Mapa sin conexión de puntos asignados",
  "mobile.day.locationDenied": "Ubicación no autorizada. Puedes seguir con la lista.",
  "mobile.day.locationUnavailable": "Ubicación no disponible. Puedes seguir con la lista.",
  "mobile.day.locationSearching": "Buscando tu ubicación…",
  "mobile.day.locationNoFix": "Sin señal exacta de ubicación. Puedes seguir.",
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
    "La lista cambió. Revisa los puntos y confirma la nueva versión. Si una falla registrada ya no aparece, pide ayuda a tu supervisor; conservamos la evidencia.",
  "mobile.shiftOpen.confirmCatalog": "Confirmar lista y volver a revisar",
  "mobile.shiftOpen.start": "Abrir jornada",
  "mobile.shiftOpen.resume": "Retomar apertura",
  "mobile.shiftOpen.noShift": "Aún no abres jornada",
  "mobile.shiftOpen.opened": "Jornada guardada en este teléfono",
  "mobile.shiftOpen.noAssignment":
    "La asignación de zona aún no está disponible en esta versión. Puedes preparar tu jornada.",
  "mobile.shiftOpen.inbox": "Ver envíos",
  "mobile.shiftOpen.motorcycleTitle": "Paso 1 de 4 · Elige tu moto",
  "mobile.shiftOpen.motorcycleHint":
    "Escribe y confirma el código de la moto. La oficina revisará que exista y esté disponible.",
  "mobile.shiftOpen.motorcycleCode": "Código de la moto",
  "mobile.shiftOpen.continue": "Continuar",
  "mobile.shiftOpen.checklistTitle": "Paso 2 de 4 · Revisa tu moto",
  "mobile.shiftOpen.unconfigured":
    "La lista de seguridad no está configurada. Actualiza la lista o pide a tu supervisor que lo configure. No puedes salir.",
  "mobile.shiftOpen.catalogUnavailable":
    "No se pudo actualizar la lista. Conservamos la última copia guardada. Revisa tu sesión y conexión y vuelve a intentar.",
  "mobile.shiftOpen.refreshCatalog": "Actualizar lista de seguridad",
  "mobile.shiftOpen.ok": "Bien",
  "mobile.shiftOpen.minor": "Falla leve",
  "mobile.shiftOpen.severeResult": "Falla grave",
  "mobile.shiftOpen.note": "Observación (opcional)",
  "mobile.shiftOpen.requiredNote": "Observación obligatoria",
  "mobile.shiftOpen.odometerTitle": "Paso 3 de 4 · Km inicial",
  "mobile.shiftOpen.photoHint":
    "La foto del odómetro es opcional, salvo que la lista la requiera evidencia. Las fotos guardadas permanecen en este teléfono.",
  "mobile.shiftOpen.capturePhoto": "Tomar foto",
  "mobile.shiftOpen.photoUnavailable":
    "No se pudo abrir la cámara. Permite la cámara e inténtalo otra vez; tu captura sigue en el teléfono.",
  "mobile.shiftOpen.photoCount": "Fotos guardadas en este teléfono:",
  "mobile.shiftOpen.odometerKm": "Km que marca el odómetro (entero)",
  "mobile.shiftOpen.lastOdometer": "Último km conocido por este teléfono:",
  "mobile.shiftOpen.unknownOdometer": "Sin referencia local; la oficina la revisará.",
  "mobile.shiftOpen.odometerWarning":
    "Es menor que el último km conocido. Revisa la lectura; puedes continuar sin perderla. La oficina podrá ponerla en revisión.",
  "mobile.shiftOpen.mapsTitle": "Paso 4 de 4 · Preparar mapa",
  "mobile.shiftOpen.mapReady":
    "Mapa guardado en el teléfono. Puedes continuar si la revisión de la moto está completa.",
  "mobile.shiftOpen.mapUnavailable":
    "El mapa todavía no está disponible. Conéctate a internet y vuelve a intentar.",
  "mobile.shiftOpen.mapPreparing": "Guardando el mapa en el teléfono. Todavía no puedes salir.",
  "mobile.shiftOpen.mapFailed":
    "No se pudo preparar el mapa. Conservamos el avance. Revisa la conexión y vuelve a intentar.",
  "mobile.shiftOpen.mapIncomplete":
    "Al mapa guardado le faltan partes. Vuelve a guardarlo antes de salir.",
  "mobile.shiftOpen.mapProgress": "Avance de preparación (%):",
  "mobile.shiftOpen.recordSevere": "Guardar falla grave · No salir",
  "mobile.shiftOpen.severe":
    "No puedes salir con esta moto. Guarda la falla grave y avisa a tu supervisor para que gestione la liberación de flota. Guardarla no confirma que la oficina la recibió.",
  "mobile.shiftOpen.editChecklist": "Volver a elegir moto y revisar",
  "mobile.shiftOpen.motorcycle":
    "Confirma el código de la moto. Si el teléfono dice que está bloqueada, pide ayuda a tu supervisor.",
  "mobile.shiftOpen.checklist": "Contesta todos los puntos de seguridad antes de continuar.",
  "mobile.shiftOpen.noteGate": "Describe la falla grave o el motivo de Otro antes de guardar.",
  "mobile.shiftOpen.photo":
    "La lista exige una foto. Captúrala antes de salir; en esta versión no hay cámara disponible.",
  "mobile.shiftOpen.odometer":
    "Escribe los kilómetros como un número entero. Conservamos lo que escribiste.",
  "mobile.shiftOpen.map":
    "Falta guardar el mapa en el teléfono. Conéctate a internet y vuelve a intentar.",
  "mobile.shiftOpen.rejected":
    "La oficina rechazó la apertura. Revisa el resultado en Envíos y consulta a tu supervisor antes de salir.",
  "mobile.shiftOpen.phoneSaved":
    "Tu jornada está abierta. La oficina la recibirá cuando haya internet.",
  "mobile.shiftOpen.serverReceived": "La oficina ya recibió tu jornada.",
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
    "Falta configurar la conexión. Pide ayuda a tu supervisor; tus registros se guardan en el teléfono.",

  // Top-bar sync chip
  "mobile.chip.allSent": "Todo enviado",
  "mobile.chip.toUpload": "{count} por enviar",
  "mobile.chip.noSignal": "Sin internet · {count} por enviar",
  "mobile.chip.noSignalEmpty": "Sin internet",
  "mobile.chip.error": "Error: revisar",
  "mobile.chip.hint": "Abre Envíos",

  // Sync inbox (P28)
  "mobile.inbox.title": "Envíos",
  "mobile.inbox.lastConnection": "Última conexión: {time}",
  "mobile.inbox.neverConnected": "Aún no hay conexión con la oficina",
  "mobile.inbox.problems": "Con problema",
  "mobile.inbox.onPhone": "En el teléfono · {count}",
  "mobile.inbox.sent": "Enviados · {count}",
  "mobile.inbox.tryNow": "Intentar ahora",
  "mobile.inbox.evidencePending":
    "Referencias de fotos pendientes: {count}. Esto no confirma la recepción del registro.",
  "mobile.inbox.evidenceError":
    "Algunas referencias de fotos siguen incompletas. Usa Intentar ahora; si el archivo no está disponible, contacta a tu coordinador.",
  "mobile.inbox.empty": "No hay registros todavía. Lo que captures aparecerá aquí.",
  "mobile.inbox.groupTitle": "{count} · {label}",
  "mobile.inbox.timeRange": "{from} a {to}",
  "mobile.inbox.offline":
    "Sin señal. Tus registros están guardados y se enviarán cuando vuelva la conexión.",
  "mobile.inbox.rejectionQuota":
    "Se alcanzó el límite diario de registros por revisar. Tus registros siguen guardados; se enviarán después de la espera indicada en la oficina.",
  "mobile.inbox.waitingRetry":
    "No pudimos conectar con la oficina. La app lo intentará de nuevo sola.",
  "mobile.inbox.parkedHint":
    "Este registro no se pudo enviar tal como está. Pulsa «Intentar ahora»; si se repite, avisa a tu supervisor.",

  // Why sending is paused
  "mobile.blocked.needsLogin":
    "Tu sesión terminó. Inicia sesión para que se envíen tus registros; no se perdió nada.",
  "mobile.blocked.clockWrong":
    "La fecha y la hora del teléfono no son correctas. Corrígelas en los ajustes del teléfono y tus registros se enviarán solos.",
  "mobile.blocked.noServer":
    "Falta configurar la conexión. Pide ayuda a tu supervisor; no se perdió nada.",
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
  "mobile.settings.server": "Conexión",
  "mobile.settings.serverHint":
    "Dirección que te dio tu supervisor, por ejemplo https://api.ejemplo.com",
  "mobile.settings.serverSave": "Guardar dirección",
  "mobile.settings.serverReset": "Usar la predeterminada",
  "mobile.settings.serverIdentityBound":
    "La oficina forma parte de la identidad de este tel\u00e9fono y no se puede cambiar aqu\u00ed. Llama a tu supervisor.",
  "mobile.settings.serverSaved": "Dirección guardada",
  "mobile.settings.serverInvalid":
    "La dirección no es válida. Escríbela completa, sin ruta, por ejemplo https://api.ejemplo.com",
  "mobile.settings.serverCleartext":
    "Usa https. Solo las versiones de prueba permiten http en redes privadas, por ejemplo http://192.168.1.20:8000.",

  // Test tools (development builds only)
  "mobile.dev.title": "Pruebas (solo builds de desarrollo)",
  "mobile.dev.deviceId": "ID de este teléfono",
  "mobile.dev.addEvent": "Agregar registro de prueba",
  // P1/P2 authentication and local unlock
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
  "mobile.login.cleanupFailed":
    "El teléfono no pudo preparar el inicio de sesión. Reintenta; tus registros capturados siguen guardados.",
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
    "Falta configurar la conexión. Toca Configurar conexión o pide ayuda a tu supervisor.",
  "mobile.login.serverSettings": "Configurar conexión",
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
  "mobile.lifecycle.advisoryUnavailable":
    "Recomendación no disponible para este instante y estas reglas. Puedes continuar la captura.",
  "mobile.lifecycle.advisoryFuture":
    "El instante de captura aún es futuro para la oficina. Reintenta después.",
  "mobile.lifecycle.advisoryAt":
    "Hechos observados hasta {at}. Una llegada tardía o anulación puede cambiar esta consulta.",
  "mobile.lifecycle.advisoryCounts":
    "Semanas de casa cerrada: {weeks}. Incidentes del punto: {incidents}.",
  "mobile.lifecycle.advisorySuggested":
    "Las reglas sugieren revisar una reubicación. Guardarla sólo crea una propuesta.",
  "mobile.lifecycle.advisoryNotSuggested":
    "La observación disponible no alcanza los umbrales de sugerencia.",
  "mobile.lifecycle.legacyAdvisory":
    "Sólo hay historia local parcial; no confirma el total de incidentes del punto.",
  "mobile.lifecycle.decisionReasonUnknown": "Motivo histórico no disponible.",
  "mobile.lifecycle.decisionTimeUnknown": "Fecha histórica de decisión no disponible.",
  "mobile.lifecycle.sourceVoided":
    "La fuente fue anulada: {at}. La propuesta y su evidencia se conservan.",
  "mobile.lifecycle.legacyDecision":
    "Registro local anterior conservado como auditoría; no confirma una revisión de la oficina.",
  "mobile.lifecycle.taskReferenceOnly":
    "Referencia programada; todavía no es una tarea vigente asignada a ti.",
  "mobile.lifecycle.taskAssigned": "Tarea vigente asignada a ti y pendiente de completar.",
  "mobile.lifecycle.openTask": "Ver tarea asignada",
  "mobile.lifecycle.ingestAccepted": "Resultado original de recepción: aceptado.",
  "mobile.lifecycle.ingestRejected": "Resultado original de recepción: rechazado.",
  "mobile.lifecycle.ingestReview": "Resultado original de recepción: en revisión.",
  "mobile.lifecycle.reviewedTitle": "Decisión posterior de la oficina",
  "mobile.lifecycle.effectApplied": "Efecto aplicado tras revisión.",
  "mobile.lifecycle.effectAdopted": "Efecto anterior reconocido; conserva su procedencia original.",
  "mobile.lifecycle.effectDiscarded": "Trabajo descartado por decisión; conserva su historia.",
  "mobile.lifecycle.effectIncident": "Incidente abierto; esto no acepta la captura original.",
  "mobile.lifecycle.effectApproved": "Jornada revisada; no concede permiso nuevo de captura.",
  "mobile.lifecycle.effectObserved": "Observación de jornada registrada.",
  "mobile.lifecycle.approvalNotCurrent": "Esta validación ya no es la aprobación vigente.",
  "mobile.lifecycle.nonterminalDecision": "Decisión informativa; la revisión puede continuar.",
  "mobile.lifecycle.limitsUnavailable":
    "Selecciona un motivo de la lista descargada con límites conocidos antes de corregir.",
  "mobile.lifecycle.reasonLimits":
    "Caracteres visibles mínimos para esta opción: {min}. Límite de la nota: {max} caracteres.",
  "mobile.lifecycle.epochClosed":
    "El cuadrante está cerrado. No se pueden guardar nuevas capturas en este marco.",
  "mobile.lifecycle.epochUnknown":
    "Falta un marco actual verificable. Actualiza; el borrador se conserva.",
  "mobile.lifecycle.recoveryBlocked":
    "El borrador se conserva, pero su propiedad no está probada para esta sesión. Entra con la cuenta original o pide ayuda a soporte.",
  "mobile.lifecycle.remoteProposal":
    "Propuesta descargada de la oficina; no es una captura local editable.",
  "mobile.supplyReceipt.title": "Recibir insumos",
  "mobile.supplyReceipt.subtitle": "Firma solo lo que recibiste físicamente",
  "mobile.supplyReceipt.start": "Revisar esta entrega",
  "mobile.supplyReceipt.resume": "Abrir recibo guardado",
  "mobile.supplyReceipt.assignment": "Asignación",
  "mobile.supplyReceipt.release": "Salida de almacén",
  "mobile.supplyReceipt.lot": "Lote",
  "mobile.supplyReceipt.piece": "Pieza",
  "mobile.supplyReceipt.unit": "Unidad declarada",
  "mobile.supplyReceipt.expected": "Cantidad esperada",
  "mobile.supplyReceipt.actual": "Cantidad recibida",
  "mobile.supplyReceipt.declaredUnits":
    "Usa la unidad declarada en esta entrega. No conviertas cajas a piezas. Los códigos y nombres de unidad aún no están disponibles; verifica los identificadores con almacén.",
  "mobile.supplyReceipt.noAssignments":
    "No hay entregas asignadas disponibles en la copia descargada. Puedes actualizar o volver a tu jornada.",
  "mobile.supplyReceipt.unavailable":
    "Falta una copia actual autorizada de tus entregas. Actualiza con señal o pide ayuda a tu supervisor. Tus recibos se conservan.",
  "mobile.supplyReceipt.refresh": "Actualizar entregas",
  "mobile.supplyReceipt.working": "Guardando en el teléfono…",
  "mobile.supplyReceipt.save": "Guardar recibo firmado en el teléfono",
  "mobile.supplyReceipt.saved":
    "Recibo firmado guardado en el teléfono. Esto aún no confirma su recepción en la oficina.",
  "mobile.supplyReceipt.serverReceived":
    "Acuse inicial: la oficina recibió el recibo. Consulta por separado cualquier revisión de tu supervisor.",
  "mobile.supplyReceipt.review":
    "Acuse inicial: la oficina recibió el recibo para revisión. Se conserva lo que firmaste; este acuse por sí solo no confirma inventario acreditado.",
  "mobile.supplyReceipt.rejected":
    "La oficina no aplicó el recibo. La captura y tu firma se conservan; revisa Envíos o pide ayuda a tu supervisor.",
  "mobile.supplyReceipt.pendingSignature":
    "La firma está guardada en el teléfono y su archivo sigue pendiente de carga. Puedes consultar o reintentar en Envíos.",
  "mobile.supplyReceipt.inbox": "Abrir Envíos",
  "mobile.supplyReceipt.scanLabel": "Código QR del lote",
  "mobile.supplyReceipt.scanHint":
    "Apunta la cámara al código QR del lote. Si no se puede leer, pide ayuda a tu supervisor.",
  "mobile.supplyReceipt.scan": "Validar QR del lote",
  "mobile.supplyReceipt.manual": "Escribir el código del lote",
  "mobile.supplyReceipt.duplicate": "Este código ya fue registrado. No se agregó otra pieza.",
  "mobile.supplyReceipt.added":
    "Código reconocido. Revisa la cantidad en la unidad declarada antes de firmar.",
  "mobile.supplyReceipt.invalid":
    "No pudimos validar este código para tu entrega. No se agregó. Verifica el identificador con almacén o tu supervisor.",
  "mobile.supplyReceipt.discrepancy": "Explica cualquier diferencia",
  "mobile.supplyReceipt.missing": "Falta material",
  "mobile.supplyReceipt.damaged": "Llegó dañado",
  "mobile.supplyReceipt.other": "Otro (especificar)",
  "mobile.supplyReceipt.discrepancyText": "Explicación de la diferencia",
  "mobile.supplyReceipt.discrepancyHint":
    "Firma las cantidades reales. La oficina conservará la diferencia para revisión; no cambies las cantidades para hacerlas coincidir.",
  "mobile.supplyReceipt.photo": "Fotografiar el daño",
  "mobile.supplyReceipt.photoSaved":
    "Foto del daño conservada solo en el teléfono. Aún no puede enviarse junto con este recibo; pide ayuda a tu supervisor.",
  "mobile.supplyReceipt.signatureTitle": "Firma de recibido",
  "mobile.supplyReceipt.signatureHint":
    "Firma aquí con el dedo o fotografía tu firma manuscrita. La firma corresponde a las cantidades y diferencias que aparecen arriba.",
  "mobile.supplyReceipt.signatureCapture": "Conservar esta firma",
  "mobile.supplyReceipt.signaturePhoto": "Fotografiar mi firma manuscrita",
  "mobile.supplyReceipt.signatureSaved": "Firma conservada en el teléfono",
  "mobile.supplyReceipt.undo": "Deshacer último trazo",
  "mobile.supplyReceipt.clear": "Empezar la firma de nuevo",
  "mobile.supplyReceipt.signatureRequired":
    "Falta tu firma. Firma con el dedo o fotografía tu firma manuscrita antes de guardar.",
  "mobile.supplyReceipt.quantityInvalid":
    "Revisa las cantidades en su unidad declarada. Una pieza solo admite cero o uno; el resto admite hasta seis decimales dentro de la entrega.",
  "mobile.supplyReceipt.discrepancyRequired":
    "Declara el motivo de la diferencia antes de firmar el recibo.",
  "mobile.supplyReceipt.otherRequired": "Escribe una explicación para Otro antes de guardar.",
  "mobile.supplyReceipt.evidenceRequired":
    "Falta la foto del daño. Tómala antes de firmar; el resto de tu captura se conserva.",
  "mobile.supplyReceipt.staleDraft":
    "La captura cambió mientras trabajabas. Revisa el recibo conservado y vuelve a intentar.",
  "mobile.supplyReceipt.shiftRequired":
    "Abre una jornada autorizada antes de recibir insumos. Tu borrador se conserva.",
  "mobile.supplyReceipt.configurationRequired":
    "Faltan listas o reglas descargadas. Actualiza con señal antes de firmar.",
  "mobile.supplyReceipt.startScanner": "Escanear QR con la cámara",
  "mobile.supplyReceipt.scannerTitle": "Escanear lote de esta entrega",
  "mobile.supplyReceipt.scannerHint":
    "Apunta al código QR del lote. El lector se cierra después de cada lectura; revisa la cantidad antes de firmar.",
  "mobile.supplyReceipt.stopScanner": "Cerrar lector y volver al recibo",
  "mobile.supplyReceipt.scannerPermission":
    "El permiso de cámara no está disponible. Puedes activarlo en Ajustes o usar la captura manual del identificador.",
  "mobile.supplyReceipt.scannerRetry":
    "Desbloquea el teléfono y vuelve a abrir el lector desde este recibo. La captura manual sigue disponible.",
  "mobile.supplyReceipt.scannerUnavailable":
    "No pudimos abrir la cámara. Vuelve a intentar o usa la captura manual del identificador.",
  "mobile.supplyReceipt.reviewedAccepted": "Revisión posterior: recibo aceptado por el supervisor.",
  "mobile.supplyReceipt.reviewedVoided":
    "Revisión posterior: recibo anulado por el supervisor. La captura firmada se conserva.",
  "mobile.supplyReceipt.incidentOpen":
    "Revisión posterior: se abrió una incidencia. Esto no acepta ni anula el recibo.",
  "mobile.fuel.title": "Cargar gasolina",
  "mobile.fuel.subtitle": "Captura sin señal · moto de tu jornada",
  "mobile.fuel.motorcycle": "Moto",
  "mobile.fuel.motorcycleFixed": "La moto es la de tu jornada abierta; no se puede cambiar aquí.",
  "mobile.fuel.litres": "Litros (L)",
  "mobile.fuel.amount": "Monto (MXN)",
  "mobile.fuel.odometer": "Odómetro actual (km)",
  "mobile.fuel.fullRefill": "¿Llenaste el tanque?",
  "mobile.fuel.fullRefillYes": "Sí · tanque lleno",
  "mobile.fuel.fullRefillNo": "No · carga parcial",
  "mobile.fuel.receipt": "Foto del ticket",
  "mobile.fuel.receiptPreview": "Vista previa privada del ticket de esta carga",
  "mobile.fuel.receiptCheck":
    "Revisa que se lean los números. Si está borrosa, repite la foto con más luz y sin moverte; tus cantidades se conservan.",
  "mobile.fuel.receiptSaved": "La foto original del ticket se conserva con esta carga.",
  "mobile.fuel.noReceiptSaved":
    "Esta carga se guardó sin foto del ticket; el recibo queda pendiente.",
  "mobile.fuel.noReceipt":
    "Sin foto del ticket. Puedes intentar tomarla o guardar la carga con el recibo pendiente.",
  "mobile.fuel.takePhoto": "Tomar foto del ticket",
  "mobile.fuel.retake": "Repetir foto del ticket",
  "mobile.fuel.previewUnavailable":
    "No pudimos mostrar la vista previa. La referencia se conserva; revisa la foto antes de guardar o vuelve a tomarla.",
  "mobile.fuel.photoUnavailable":
    "No pudimos abrir la cámara. Vuelve a intentar; tus cantidades y la foto anterior se conservan.",
  "mobile.fuel.insufficient":
    "Datos insuficientes para calcular el rendimiento: se necesitan cargas completas consecutivas con distancia conocida. Puedes guardar la carga y cerrar tu jornada.",
  "mobile.fuel.unconfigured":
    "No hay límites de rendimiento descargados para este intervalo. Puedes guardar; la oficina revisará la carga al recibirla.",
  "mobile.fuel.decreased":
    "El odómetro es menor que la lectura anterior. Revisa el número; puedes conservarlo y guardar la carga.",
  "mobile.fuel.efficiencyOk":
    "Rendimiento del intervalo comparable dentro de los límites informativos.",
  "mobile.fuel.efficiencyReview":
    "El rendimiento queda fuera del rango informativo. Revisa litros y odómetro; puedes guardar así y cerrar tu jornada.",
  "mobile.fuel.saved": "Guardada en el teléfono · pendiente de recibir en la oficina.",
  "mobile.fuel.serverReceived": "Carga recibida en la oficina.",
  "mobile.fuel.reviewPending":
    "Carga recibida en la oficina · pendiente de revisión. Las cantidades se conservan.",
  "mobile.fuel.rejected":
    "La oficina rechazó esta carga. La captura se conserva; revisa el motivo en Envíos y avisa a tu supervisor.",
  "mobile.fuel.receiptPending":
    "Ticket pendiente de envío o verificación; no es una revisión de la carga.",
  "mobile.fuel.receiptVerified":
    "Foto del ticket verificada en la oficina; no es una revisión de la carga.",
  "mobile.fuel.reviewedAccepted": "Revisión posterior: carga aceptada por el supervisor.",
  "mobile.fuel.reviewedVoided":
    "Revisión posterior: carga anulada. La captura original se conserva.",
  "mobile.fuel.incidentOpen":
    "Revisión posterior: se abrió una incidencia; la carga no queda aceptada ni anulada.",
  "mobile.fuel.litresInvalid":
    "Escribe litros mayores que cero, con hasta tres decimales y sin separadores de miles.",
  "mobile.fuel.amountInvalid":
    "Escribe un monto mayor que cero, con hasta dos decimales y sin separadores de miles.",
  "mobile.fuel.odometerInvalid":
    "Escribe kilómetros enteros entre 0 y 999999, sin separadores de miles.",
  "mobile.fuel.unavailable":
    "La jornada o los datos descargados no autorizan esta captura. Revisa tu jornada y vuelve a intentar; el borrador se conserva.",
  "mobile.fuel.shiftRequired":
    "Abre una jornada autorizada antes de cargar gasolina. Tu borrador se conserva.",
  "mobile.fuel.staleDraft":
    "La captura cambió mientras trabajabas. Revisa el borrador conservado y vuelve a intentar.",
  "mobile.fuel.draftSaved":
    "Borrador en este teléfono · revisa los datos antes de guardar la carga.",
  "mobile.fuel.draftPending":
    "Hay cambios pendientes de guardar en el teléfono. Vuelve a intentar antes de salir.",
  "mobile.fuel.empty":
    "Todavía no hay una captura de gasolina. Inicia una para la moto de tu jornada.",
  "mobile.fuel.begin": "Iniciar captura de gasolina",
  "mobile.fuel.beginAnother": "Capturar otra carga",
  "mobile.fuel.save": "Guardar carga",
  "mobile.fuel.working": "Guardando en el teléfono…",
  "mobile.fuel.saveHint":
    "Guardar conserva la carga en este teléfono. El envío y la revisión ocurren después.",
  "mobile.fuel.inbox": "Ver lo que envié",
  "mobile.incidents.title": "Reportar problema",
  "mobile.incidents.subtitle": "Captura local y conversación con tu equipo",
  "mobile.incidents.emergency": "Emergencia",
  "mobile.incidents.emergencyHint":
    "Ponte a salvo. La captura no confirma que alguien recibió el aviso.",
  "mobile.incidents.report": "Incidente",
  "mobile.incidents.accident": "Accidente",
  "mobile.incidents.unavailable":
    "La captura no está habilitada con el contexto actual. Conservamos tus borradores; desbloquea la app o actualiza tu jornada.",
  "mobile.incidents.shiftRequired":
    "Abre o revisa tu jornada para reportar. La llamada de apoyo no requiere guardar un reporte.",
  "mobile.incidents.staleDraft":
    "La captura cambió mientras trabajabas. Conservamos lo anterior; vuelve a abrirla antes de reintentar.",
  "mobile.incidents.typeRequired": "Selecciona un tipo de incidente.",
  "mobile.incidents.descriptionRequired": "Describe lo ocurrido para guardar el incidente.",
  "mobile.incidents.descriptionLong": "Acorta la descripción a 4000 caracteres y vuelve a guardar.",
  "mobile.incidents.evidenceLimit":
    "La captura admite hasta 100 fotos. Conserva el resto en el teléfono.",
  "mobile.incidents.photoUnavailable":
    "No se pudo abrir la cámara. Conservamos la captura; reintenta cuando estás a salvo.",
  "mobile.incidents.saved": "Guardado en el teléfono: pendiente de envío.",
  "mobile.incidents.serverReceived": "Recibido en la oficina.",
  "mobile.incidents.reviewPending":
    "Recibido en la oficina: requiere revisión. La captura original se conserva.",
  "mobile.incidents.rejected":
    "La oficina no aceptó el reporte. Se conserva en el teléfono; revisa el motivo en Envíos.",
  "mobile.incidents.evidencePending":
    "Hay fotos pendientes de verificación. La captura sigue guardada; revisa Envíos para reintentar el envío.",
  "mobile.incidents.noDeliveryPromise":
    "Recibir el reporte no confirma que tu supervisor lo leyó ni que la ayuda va en camino.",
  "mobile.incidents.description": "Descripción de lo ocurrido",
  "mobile.incidents.optionalDescription": "Detalle opcional del accidente",
  "mobile.incidents.searchTypes": "Buscar tipo de incidente",
  "mobile.incidents.noTypeMatches": "No hay tipos que coincidan. Cambia la búsqueda.",
  "mobile.incidents.noTypes":
    "No hay tipos descargados disponibles. Actualiza los tipos con conexión o pide al administrador que revise la configuración.",
  "mobile.incidents.chooseType": "Elegir tipo",
  "mobile.incidents.type": "Tipo de incidente",
  "mobile.incidents.otherHint": "Otro requiere que expliques lo ocurrido en la descripción.",
  "mobile.incidents.evidence": "Fotos de evidencia",
  "mobile.incidents.evidenceMinimum": "Mínimo de fotos configurado para este tipo:",
  "mobile.incidents.evidenceMissing":
    "Falta evidencia requerida. Puedes conservar el reporte; la oficina puede enviarlo a revisión.",
  "mobile.incidents.uploadUnavailable":
    "Tu contexto actual no permite adjuntar fotos. Conserva los detalles y pide apoyo al supervisor.",
  "mobile.incidents.takePhoto": "Agregar foto",
  "mobile.incidents.photoPreview": "Vista previa de evidencia del incidente",
  "mobile.incidents.previewUnavailable":
    "No se pudo mostrar esta foto. El archivo se conserva; revisa la captura antes de guardar.",
  "mobile.incidents.originalTime": "Hora original de captura (UTC)",
  "mobile.incidents.gpsCaptured": "Se guardó la ubicación disponible con la captura.",
  "mobile.incidents.noGps":
    "Sin ubicación disponible. No se inventó una ubicación para este reporte.",
  "mobile.incidents.mine": "Mis incidentes y comentarios",
  "mobile.incidents.pageHint":
    "Solo tus reportes disponibles en la página descargada. Actualiza con conexión para consultar respuestas; esta lista puede estar incompleta.",
  "mobile.incidents.repliesUnavailable":
    "Los comentarios del equipo se consultan con conexión. La respuesta desde el móvil aún no está disponible.",
  "mobile.incidents.noIncidents": "Aún no has reportado nada hoy.",
  "mobile.incidents.readUnavailable":
    "El contexto actual no permite consultar esta conversación. Los borradores siguen guardados.",
  "mobile.incidents.readFailed":
    "No se pudo actualizar. Conservamos la captura y lo que aún está autorizado en este teléfono. Reintenta con conexión.",
  "mobile.incidents.refreshing": "Actualizando tipos y comentarios...",
  "mobile.incidents.refresh": "Actualizar tipos, contacto y comentarios",
  "mobile.incidents.onPhone": "Capturas guardadas en este teléfono",
  "mobile.incidents.draftPending":
    "Hay texto pendiente de guardar. Reintenta antes de cerrar la captura.",
  "mobile.incidents.draftSaved":
    "Borrador guardado en el teléfono. Falta guardar el reporte para enviarlo.",
  "mobile.incidents.empty":
    "Inicia un reporte para elegir su tipo, describir lo ocurrido y adjuntar evidencia.",
  "mobile.incidents.accidentHint":
    "Puedes guardar un accidente sin foto ni detalle. La falta de señal nunca confirma aviso entregado.",
  "mobile.incidents.saveHint":
    "Guardar conserva el reporte en este teléfono. El envío y la revisión son pasos posteriores.",
  "mobile.incidents.working": "Guardando en el teléfono...",
  "mobile.incidents.save": "Guardar reporte en el teléfono",
  "mobile.incidents.begin": "Iniciar reporte",
  "mobile.incidents.beginAccident": "Capturar accidente",
  "mobile.incidents.safeClose": "Continuar al cierre de jornada",
  "mobile.incidents.callWorkContact": "Llamar a mi supervisor",
  "mobile.incidents.dialerOpened":
    "Se abrió el teléfono. Esto no confirma una llamada ni que alguien recibió el aviso; depende del dispositivo y la red.",
  "mobile.incidents.dialerUnavailable":
    "No se pudo abrir la llamada. Usa la app Teléfono del dispositivo y busca ayuda cuando sea seguro. El reporte se conserva.",
  "mobile.incidents.contactMissing":
    "No hay un teléfono laboral validado disponible. No se configuró un número de emergencias para esta app.",
  "mobile.incidents.callFallback": "En una emergencia, llama también al 911.",
  "mobile.history.title": "Mi historial",
  "mobile.history.search": "Buscar código o referencia",
  "mobile.history.partial":
    "Copia local parcial: los registros guardados, recibidos y revisados tienen estados distintos.",
  "mobile.history.failed":
    "No pudimos actualizar. Conservamos tus capturas; reintenta con conexión.",
  "mobile.history.refresh": "Actualizar historial",
  "mobile.history.allShifts": "Volver a jornadas",
  "mobile.history.noMatches":
    "No hay coincidencias en esta copia. Cambia la búsqueda o actualiza con conexión.",
  "mobile.history.unavailable":
    "Historial no disponible. Actualiza con conexión o pide a tu supervisor revisar el acceso.",
  "mobile.history.unknownTime": "Fecha no disponible",
  "mobile.history.shift": "Jornada",
  "mobile.history.openShift": "Ver eventos y observaciones",
  "mobile.history.reviewed": "Revisado",
  "mobile.history.voided": "Anulado",
  "mobile.history.observed": "Con observaciones",
  "mobile.history.received": "Recibido en la oficina",
  "mobile.history.serverFact": "Observación de la oficina",
  "mobile.history.author": "Autor (nombre o referencia)",
  "mobile.history.unavailableValue": "No disponible",
  "mobile.history.reference": "Referencia original",
  "mobile.history.reason": "Motivo u observación",
  "mobile.history.voids": "Corrige la referencia",
  "mobile.settings.textSize": "Tamaño de texto",
  "mobile.settings.textSystem": "Igual que el teléfono",
  "mobile.settings.textLarge": "Texto adicionalmente 30 % más grande",
  "mobile.settings.saveFailed":
    "No pudimos guardar tu preferencia. Conservamos la selección anterior; vuelve a elegir para reintentar.",
  "mobile.settings.readFailed":
    "No pudimos consultar el estado local. Reintenta; puedes bloquear el acceso sin borrar tus capturas.",
  "mobile.settings.version": "Versión de la app en ejecución",
  "mobile.settings.updaterUnavailable":
    "No pudimos revisar si hay una actualización. Consulta a soporte.",
  "mobile.settings.support": "Contacto de soporte de la organización",
  "mobile.settings.supportUnavailable": "No hay contacto configurado. Pide apoyo a tu supervisor.",
  "mobile.settings.pendingWork": "Trabajo conservado en el teléfono",
  "mobile.settings.events": "Registros pendientes de recepción",
  "mobile.settings.files": "Archivos pendientes de verificación o vínculo",
  "mobile.settings.drafts": "Borradores sin guardar como registro",
  "mobile.settings.lockHint":
    "Cerrar el acceso bloquea este teléfono. Conserva borradores, archivos y envíos; desbloquea con tu PIN para continuar. Tu sesión mantiene su vigencia original.",
  "mobile.settings.viewUploads": "Ver envíos y observaciones",
  "mobile.settings.lockAccess": "Cerrar acceso local y conservar trabajo",

  // Speed lock and global states (M-16)
  "mobile.global.levelBlocking": "Bloqueo",
  "mobile.global.levelWarning": "Aviso",
  "mobile.global.levelInfo": "Información",
  "mobile.global.causeSpeedLock": "Te estás moviendo rápido.",
  "mobile.global.causeSessionEnded": "Tu sesión terminó; tus borradores y envíos siguen guardados.",
  "mobile.global.causeStorageFull":
    "El teléfono casi no tiene espacio; no se puede guardar con seguridad.",
  "mobile.global.causeStorageLow": "Queda poco espacio en el teléfono.",
  "mobile.global.causeUpdateRequired": "Hay una actualización necesaria de la app.",
  "mobile.global.causeUpdateAvailable": "Hay una versión nueva de la app.",
  "mobile.global.causeClockSkew":
    "La hora del teléfono no coincide con la de la oficina; tus registros quedarán en revisión.",
  "mobile.global.causeGpsOff": "Tu ubicación está apagada.",
  "mobile.global.causeGpsDenied": "La app no tiene permiso de ubicación.",
  "mobile.global.causeGpsSearching": "Buscando tu ubicación…",
  "mobile.global.causeGpsNoFix": "Sin señal exacta de ubicación.",
  "mobile.global.causeGpsUnreliable": "Tu ubicación es aproximada.",
  "mobile.global.causeBatteryLow": "Batería baja.",
  "mobile.global.causeNoSignal": "Sin señal: nada se pierde, todo se sube cuando haya red.",
  "mobile.global.nextStopMoving":
    "Detente en un lugar seguro; al pasar unos segundos vuelves al mismo paso.",
  "mobile.global.nextSignIn": "Inicia sesión para continuar donde te quedaste.",
  "mobile.global.nextFreeSpace": "Libera espacio en el teléfono y vuelve a intentar.",
  "mobile.global.nextInstallWhenSignal": "Seguirás trabajando; se instalará cuando haya señal.",
  "mobile.global.nextInstallWhenClosing": "Instálala al cerrar jornada.",
  "mobile.global.nextKeepWorkingReview": "Puedes seguir; lo de hoy quedará en revisión, sin culpa.",
  "mobile.global.nextEnableLocation": "Actívala en los ajustes del teléfono.",
  "mobile.global.fixEnableLocation": "Activar",
  "mobile.global.fixAllowLocation": "Permitir",
  "mobile.global.fixAllowCamera": "Permitir",
  "mobile.global.fixOpenSettings": "Ajustes",
  "mobile.global.fixFreeSpace": "Liberar",
  "mobile.global.fixNetwork": "Ajustes",
  "mobile.global.nextWaitForFix": "Si tarda, sal a un lugar abierto.",
  "mobile.global.nextChargeOrSaveBattery": "Carga el teléfono o baja el brillo.",
  "mobile.global.nextKeepWorkingSaved":
    "Sigue trabajando; lo guardado en el teléfono no se pierde.",
  "mobile.global.more": "{count} avisos más",
  "mobile.speedLock.title": "Detente para seguir capturando",
  "mobile.speedLock.body":
    "Al detenerte unos segundos, vuelves al mismo paso. Lo capturado no se pierde.",
  "mobile.speedLock.speed": "Velocidad actual: {speed} km/h",
  "mobile.speedLock.limit": "Límite configurado: {limit} km/h",
  "mobile.speedLock.emergencyOnly":
    "Solo la llamada de emergencia está disponible mientras te mueves.",
  "mobile.map.label": "Mapa de tus puntos y zonas",
  "mobile.map.loading": "Preparando el mapa...",
  "mobile.map.unavailable": "El mapa no está disponible por ahora",
  "mobile.map.unavailableHint": "Conéctate una vez para guardarlo en el teléfono.",
  "mobile.map.retry": "Intentar de nuevo",
  "mobile.map.attribution": "© colaboradores de OpenStreetMap",
  "mobile.map.zone": "{name}",
} as const satisfies AreaCatalog<"mobile">;
