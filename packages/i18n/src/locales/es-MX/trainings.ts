import type { AreaCatalog } from "../area";
export const trainings = {
  "trainings.workspace.title": "Capacitaciones",
  "trainings.tab.courses": "Cursos",
  "trainings.tab.requirements": "Requisitos",
  "trainings.tab.people": "Personas",
  "trainings.workspace.evaluations": "Cédulas de evaluación",
  "trainings.workspace.denied":
    "No tienes acceso a capacitaciones en este alcance. Solicita el permiso y el alcance a Administración.",
  "trainings.field.code": "Código del curso",
  "trainings.field.name": "Nombre del curso",
  "trainings.field.validity": "Vigencia (segundos)",
  "trainings.field.noneOption": "Sin cuadrante",
  "trainings.field.pickPlaceholder": "Elige de la lista",
  "trainings.field.otherAction": "Otra acción (especificar)",
  "trainings.field.pickCourseFirst": "Primero elige el curso.",
  "trainings.field.versionOption": "Versión {version}",
  "trainings.action.release.record": "Registrar liberaciones",
  "trainings.field.actions": "Acciones habilitadas",
  "trainings.field.actionsHint":
    "Claves de acción configuradas, separadas por comas. No se asignan permisos al publicar un curso.",
  "trainings.field.effective": "Vigente desde",
  "trainings.field.instantHint":
    "Fecha y hora con zona explícita, por ejemplo 2026-11-09T12:00:00-06:00.",
  "trainings.field.center": "Centro",
  "trainings.field.quadrant": "Cuadrante (opcional)",
  "trainings.field.subject": "Persona",
  "trainings.field.action": "Acción",
  "trainings.field.at": "Fecha y hora de consulta (opcional)",
  "trainings.field.trainingVersion": "Versión del curso",
  "trainings.field.requirementVersion": "Versión del requisito",
  "trainings.field.validFrom": "Inicio incluido",
  "trainings.field.validTo": "Fin excluido",
  "trainings.field.expiryHint":
    "La certificación vence exactamente en este instante; incluye la zona horaria.",
  "trainings.field.evidence": "Evidencias verificadas",
  "trainings.field.evidenceHint":
    "Solo cargas propias verificadas y sin vincular, separadas por comas. Puedes subir y verificar una imagen arriba.",
  "trainings.evidence.file": "Imagen de la certificación",
  "trainings.evidence.hint":
    "PNG o JPEG de hasta 10 MB. La imagen se verifica antes de vincularla al registro.",
  "trainings.evidence.upload": "Cargar y verificar imagen",
  "trainings.evidence.invalid": "Elige una imagen PNG o JPEG válida de hasta 10 MB.",
  "trainings.evidence.failed":
    "No se confirmó la imagen. Conservamos el archivo; vuelve a cargarlo para renovar o verificar su recepción.",
  "trainings.evidence.verified": "Imagen verificada. Se vinculará al registrar la certificación.",
  "trainings.field.issuer": "Referencia de quien expide",
  "trainings.field.attestation": "Constancia de certificación",
  "trainings.field.status": "Estado",
  "trainings.field.certificate": "Certificación",
  "trainings.field.revoked": "Revocada desde",
  "trainings.field.nextChange": "Próximo cambio de elegibilidad",
  "trainings.field.training": "Curso",
  "trainings.field.acceptableVersions": "Versiones aceptables",
  "trainings.requirement.title": "Requisitos por acción y contexto",
  "trainings.requirement.inspect": "Consultar requisitos del contexto",
  "trainings.requirement.publish": "Publicar requisito de acción",
  "trainings.requirement.publishHint":
    "Publica una versión permanente con las versiones aceptables del curso indicado. Conserva los demás cursos exigidos por la política seleccionada; aquí no se retiran requisitos existentes. Una acción nueva parte de revisión cero; el servidor rechaza una revisión desactualizada.",
  "trainings.state.active": "Activa",
  "trainings.state.inactive": "Inactiva",
  "trainings.state.notRevoked": "Sin revocación registrada",
  "trainings.state.unconfigured": "Sin configurar",
  "trainings.state.unavailable": "No disponible",
  "trainings.course.open": "Ver curso",
  "trainings.course.create": "Nuevo curso",
  "trainings.course.createHint":
    "Crea la identidad del curso. Publica después su vigencia y las acciones que habilita.",
  "trainings.course.publish": "Publicar versión",
  "trainings.course.publishHint":
    "La nueva versión es permanente. Conserva las anteriores y no cambia las certificaciones ya registradas. Cancela para revisar antes de publicar.",
  "trainings.course.versions": "Versiones del curso",
  "trainings.course.unavailable":
    "El registro no está disponible en tu alcance. Revisa la referencia o solicita acceso a Administración.",
  "trainings.person.title": "Certificaciones por persona",
  "trainings.person.lookupHint": "Elige a la persona y el centro para ver sus capacitaciones.",
  "trainings.person.inspect": "Consultar certificaciones y elegibilidad",
  "trainings.person.certificates": "Historial de certificaciones",
  "trainings.person.create": "Registrar certificación",
  "trainings.person.createHint":
    "Registra evidencia verificada y un intervalo de vigencia explícito para esta persona y contexto. Se validan las referencias y la vigencia máxima del curso.",
  "trainings.person.uploadPermission":
    "Para registrar la certificación también necesitas permiso para vincular evidencia. Administración puede habilitarlo.",
  "trainings.eligibility.title": "Elegibilidad por capacitación",
  "trainings.eligibility.eligible": "Capacitación vigente",
  "trainings.eligibility.blocked": "Acción bloqueada por capacitación",
  "trainings.eligibility.factual":
    "Resultado factual para la acción, el contexto y el instante consultados. No concede permiso para ejecutar la acción.",
  "trainings.eligibility.unblocker":
    "Administración debe revisar los requisitos, la configuración y la certificación antes de habilitar la acción.",
  "trainings.eligibility.requirementsMissing":
    "Requisitos de capacitación sin configurar para este contexto.",
  "trainings.eligibility.configurationMissing":
    "La versión de capacitación requerida no está disponible o configurada.",
  "trainings.eligibility.certificateExpired":
    "La certificación requerida falta, está vencida o no cubre el instante consultado.",
  "trainings.eligibility.unavailable":
    "No se pudo establecer la capacitación requerida. Solicita revisión a Administración.",
  "trainings.form.invalidField": "Completa este campo con una referencia o valor válido.",
  "trainings.form.invalid": "Revisa los campos indicados.",
  "trainings.form.invalidHint":
    "Se conservaron tus datos. Las fechas necesitan zona horaria y las referencias deben ser válidos.",
  "trainings.form.failed":
    "No pudimos confirmar el registro. Conservamos tus datos; revisa el historial antes de intentar de nuevo.",
  "trainings.form.saved": "Registro guardado.",
  "trainings.form.review": "Revisé el historial; permitir otro intento",
  "trainings.form.reviewHint":
    "No se enviará otro registro automáticamente. Revisa el historial y confirma antes de volver a guardar.",
  "trainings.eligibility.refreshRequired":
    "Se alcanzó un cambio de vigencia. Actualiza la consulta para confirmar la elegibilidad con el servidor.",
  "trainings.mobile.title": "Capacitaciones y cédulas",
  "trainings.mobile.qualification": "Elegibilidad descargada por acción",
  "trainings.mobile.certificates": "Constancias descargadas",
  "trainings.mobile.evaluations": "Cédulas de evaluación",
  "trainings.mobile.eligible": "Capacitación vigente",
  "trainings.mobile.blocked": "Capacitación pendiente",
  "trainings.mobile.expired": "Vencida",
  "trainings.mobile.unavailable":
    "Necesitas sincronizar para consultar tu capacitación. No se puede confirmar la elegibilidad sin datos vigentes.",
  "trainings.mobile.boundary":
    "La capacitación no habilita esta acción. Pide a tu supervisor que revise tu vigencia y agenda de capacitación.",
  "trainings.mobile.qualificationHint":
    "La capacitación es un requisito. Los permisos y demás condiciones de cada captura se revisan por separado.",
  "trainings.mobile.validUntil": "Vigencia hasta",
  "trainings.mobile.validFrom": "Vigencia desde",
  "trainings.mobile.revoked": "Revocada",
  "trainings.mobile.future": "Aún no vigente",
  "trainings.mobile.valid": "Vigente",
  "trainings.mobile.pass": "Correcto",
  "trainings.mobile.low": "Observación para mejorar",
  "trainings.mobile.critical": "Requiere capacitación",
  "trainings.mobile.incomplete": "Evaluación incompleta",
  "trainings.mobile.voided": "Anulada; se conserva el original",
  "trainings.mobile.refresh": "Actualizar con señal",
  "trainings.mobile.refreshing": "Actualizando; conservamos la información descargada.",
  "trainings.mobile.failed":
    "No pudimos actualizar. Conservamos lo descargado; busca señal y vuelve a intentar.",
  "trainings.mobile.localFailed":
    "No pudimos leer la información del teléfono. Vuelve a intentar; tus registros y borradores se conservan.",
  "trainings.mobile.empty":
    "No hay registros en esta descarga. Actualiza con señal para revisar si hay cambios.",
  "trainings.mobile.notDownloaded":
    "Todavía no hay constancias o cédulas descargadas. Actualiza con señal.",
  "trainings.mobile.privateDenied":
    "Las cédulas privadas requieren autorización. Solicita a tu supervisor que revise tu acceso.",
  "trainings.mobile.trainingDenied":
    "Las constancias requieren autorización. Solicita a tu supervisor que revise tu acceso.",
  "trainings.mobile.partial":
    "Se muestran los primeros registros autorizados. Puede haber más historial ; consulta a tu supervisor.",
  "trainings.mobile.downloadedAt": "Descarga de constancias y cédulas",
  "trainings.mobile.author": "Autor",
  "trainings.mobile.reason": "Motivo u observación",
  "trainings.mobile.revision": "Revisión",
  "trainings.mobile.source": "Registro original",
  "trainings.mobile.context": "Centro y cuadrante",
  "trainings.state.configured": "Configurado",
  "trainings.facts.certificateCount": "Certificados vigentes: {count}",
} satisfies AreaCatalog<"trainings">;
