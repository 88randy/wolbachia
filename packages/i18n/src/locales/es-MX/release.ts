/** P18/P19 release capture and the non-overridable local safety gate. */
export const release = {
  "mobile.eventType.releaseRecord": "Liberación",
  "mobile.release.title": "Registrar liberación",
  "mobile.release.blockedTitle": "No puedes liberar",
  "mobile.release.subtitle": "Requisitos de la copia descargada",
  "mobile.release.loading": "Consultando los requisitos guardados en el teléfono…",
  "mobile.release.choose.task": "Elige la tarea de liberación",
  "mobile.release.choose.device": "Elige el dispositivo de liberación",
  "mobile.release.empty.task":
    "No hay tareas disponibles en tu copia descargada. Consulta a tu supervisor.",
  "mobile.release.empty.device":
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
    "Se registró una revisión aplicada a esta declaración. La respuesta original del servidor se conserva.",
  "mobile.release.reviewDiscarded":
    "La revisión descartó esta declaración. La evidencia y la respuesta original se conservan.",
  "mobile.release.reviewObserved":
    "Hay una revisión vinculada con esta declaración. Consulta su resultado en la bandeja.",
  "mobile.release.prerequisites": "Requisitos para liberar",
  "mobile.release.gate.permit": "Permiso vigente",
  "mobile.release.gate.zone": "Zona oficial autorizada",
  "mobile.release.gate.lot": "Lote y existencia disponibles",
  "mobile.release.gate.training": "Capacitación vigente",
  "mobile.release.gate.schedule": "Programación autorizada",
  "mobile.release.gate.gps": "Ubicación con precisión suficiente",
  "mobile.release.gate.device": "Dispositivo de liberación activo",
  "mobile.release.gate.configuration": "Configuración de captura disponible",
  "mobile.release.pass": "Comprobado",
  "mobile.release.fail": "No cumple",
  "mobile.release.unavailable": "No disponible; liberación bloqueada",
  "mobile.release.contact.supervisor": "Pide a tu supervisor que revise este requisito.",
  "mobile.release.contact.admin": "Pide al administrador que revise la configuración.",
  "mobile.release.contact.courier":
    "Obtén una ubicación precisa en un lugar seguro y vuelve a revisar.",
  "mobile.release.noBypass":
    "No liberes mientras falte un requisito. Desde aquí no hay forma de omitirlo.",
  "mobile.release.cachedOnly":
    "Esta comprobación usa la copia descargada. El servidor vuelve a validar al sincronizar.",
  "mobile.release.deviceId": "Dispositivo de liberación",
  "mobile.release.taskId": "Tarea programada",
  "mobile.release.permitId": "Permiso",
  "mobile.release.lotId": "Lote de origen",
  "mobile.release.referenceUnavailable": "Sin información comprobada",
  "mobile.release.detail.quantityInvalid":
    "Registra una cantidad mayor que cero, con hasta 14 dígitos enteros y 6 decimales.",
  "mobile.release.detail.stockUnavailable":
    "La cantidad supera la existencia recibida disponible, incluida la reservada por otros registros del teléfono.",
  "mobile.release.detail.lotBlocked":
    "El lote o su política de traslado tienen un bloqueo. No liberes; consulta a tu supervisor.",
  "mobile.release.detail.lotExpired":
    "El lote no está vigente para esta captura. No liberes; consulta a tu supervisor.",
  "mobile.release.detail.deviceBlocked":
    "El dispositivo está inactivo o retirado. No lo uses para liberar; avisa a tu supervisor.",
  "mobile.release.detail.scheduleBlocked":
    "La tarea ya fue usada o cambió su programación, permiso o responsable. No liberes con esta captura.",
  "mobile.release.detail.evidenceRequired":
    "Toma la foto de evidencia que requiere esta liberación antes de guardar.",
  "mobile.release.detail.pinsChanged":
    "Cambió una referencia original de seguridad, equipo o existencia. Conserva la captura y consulta a tu supervisor.",
  "mobile.release.detail.trainingPinInvalid":
    "La capacitación declarada no está vigente en ambas comprobaciones. No liberes; consulta a tu supervisor.",
  "mobile.release.detail.permitUnavailable": "Falta el permiso oficial en la copia descargada.",
  "mobile.release.detail.permitBlocked":
    "El permiso tiene un bloqueo o una suspensión. No liberes; consulta a tu supervisor.",
  "mobile.release.detail.permitExpired":
    "El permiso no está vigente para esta captura. No liberes; consulta a tu supervisor.",
  "mobile.release.detail.zoneUnavailable":
    "No está disponible la geometría oficial del permiso para comprobar esta ubicación.",
  "mobile.release.detail.zoneOutside":
    "La ubicación está fuera de la zona oficial autorizada. No liberes en este lugar.",
  "mobile.release.detail.gpsUnavailable":
    "Falta una ubicación válida y precisa. Obtén la ubicación en un lugar seguro.",
  "mobile.release.detail.gpsAccuracy":
    "La precisión de la ubicación no cumple el límite configurado. Vuelve a obtener la ubicación.",
  "mobile.release.detail.trainingUnavailable":
    "No se pudo comprobar tu capacitación para esta liberación.",
  "mobile.release.detail.trainingBlocked":
    "La capacitación descargada no permite esta liberación. Pide a tu supervisor que la revise.",
  "mobile.release.detail.scheduleUnavailable":
    "No se pudo comprobar una tarea autorizada vinculada con este permiso.",
  "mobile.release.detail.lotUnavailable":
    "No se pudo comprobar la seguridad del lote y su existencia recibida para esta liberación.",
  "mobile.release.detail.deviceUnavailable":
    "No se pudo comprobar el dispositivo y su lote de origen en la copia descargada.",
  "mobile.release.detail.configurationUnavailable":
    "Falta la configuración comprobada para registrar esta liberación.",
  "mobile.release.detail.scopeUnavailable":
    "La copia descargada no autoriza esta captura. Conserva el registro y consulta a tu supervisor.",
  "mobile.release.detail.contractUnavailable":
    "Faltan datos de seguridad que el servidor debe descargar al teléfono. No liberes; consulta a tu supervisor.",
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
  "mobile.release.phoneSaved": "Guardada en el teléfono. Todavía no hay recepción del servidor.",
  "mobile.release.serverReceived":
    "El servidor recibió el registro. Consulta por separado su resultado de revisión.",
  "mobile.release.inReview":
    "El servidor recibió el registro para revisión. Esto no confirma una liberación autorizada.",
  "mobile.release.criticalRejected":
    "El servidor rechazó la liberación por seguridad. La evidencia se conserva; avisa a tu supervisor. No hay opción de aprobarla desde aquí.",
  "mobile.release.evidencePending":
    "Las fotos siguen pendientes de envío o verificación. El registro permanece guardado en el teléfono.",
  "mobile.release.openInbox": "Ver recepción y resultado en la bandeja",
  "mobile.release.saveHint":
    "Guardar conserva el registro en el teléfono; no confirma autorización del servidor.",
  "mobile.release.working": "Procesando en el teléfono…",
  "mobile.release.save": "Guardar registro de liberación",
  "mobile.release.reportDevice": "Reportar dispositivo dañado",
  "mobile.release.reportSupervisor": "Reportar al supervisor",
  "mobile.release.backToDay": "Volver al día",
} as const;
