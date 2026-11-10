import type { AreaCatalog } from "../area";
export const trainings = {
  "trainings.workspace.title": "Capacitaciones",
  "trainings.workspace.evaluations": "Cédulas de evaluación",
  "trainings.workspace.denied":
    "No tienes acceso a capacitaciones en este alcance. Solicita el permiso y el alcance a Administración.",
  "trainings.field.code": "Código del curso",
  "trainings.field.name": "Nombre del curso",
  "trainings.field.validity": "Vigencia (segundos)",
  "trainings.field.actions": "Acciones habilitadas",
  "trainings.field.actionsHint":
    "Claves de acción configuradas, separadas por comas. No se asignan permisos al publicar un curso.",
  "trainings.field.effective": "Vigente desde",
  "trainings.field.instantHint":
    "Fecha y hora con zona explícita, por ejemplo 2026-11-09T12:00:00-06:00.",
  "trainings.field.center": "UUID del centro",
  "trainings.field.quadrant": "UUID del cuadrante (opcional si el alcance lo permite)",
  "trainings.field.subject": "UUID de la persona",
  "trainings.field.action": "Clave de la acción",
  "trainings.field.at": "Instante de consulta (opcional)",
  "trainings.field.trainingVersion": "Versión del curso (UUID)",
  "trainings.field.requirementVersion": "Versión del requisito",
  "trainings.field.validFrom": "Inicio incluido",
  "trainings.field.validTo": "Fin excluido",
  "trainings.field.expiryHint":
    "La certificación vence exactamente en este instante; incluye la zona horaria.",
  "trainings.field.evidence": "UUID de evidencias verificadas",
  "trainings.field.evidenceHint":
    "Solo cargas propias verificadas y sin vincular, separadas por comas. Puedes subir y verificar una imagen arriba.",
  "trainings.evidence.file": "Imagen de la certificación",
  "trainings.evidence.hint":
    "PNG o JPEG de hasta 10 MB. La imagen se verifica antes de vincularla al registro.",
  "trainings.evidence.upload": "Cargar y verificar imagen",
  "trainings.evidence.invalid": "Elige una imagen PNG o JPEG válida de hasta 10 MB.",
  "trainings.evidence.failed":
    "No se confirmó la imagen. Conservamos el archivo; vuelve a cargarlo para renovar o verificar su recepción.",
  "trainings.evidence.verified":
    "Imagen verificada por el servidor. Se vinculará al registrar la certificación.",
  "trainings.field.issuer": "Referencia de quien expide",
  "trainings.field.attestation": "Constancia de certificación",
  "trainings.field.status": "Estado",
  "trainings.field.certificate": "Certificación (UUID)",
  "trainings.field.revoked": "Revocada desde",
  "trainings.field.nextChange": "Próximo cambio de elegibilidad",
  "trainings.field.training": "Curso (UUID)",
  "trainings.field.acceptableVersions": "Versiones aceptables (UUID separados por comas)",
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
  "trainings.person.lookupHint":
    "Usa las referencias autorizadas de persona y contexto. El permiso de capacitación no permite buscar en el directorio de personal ni ver evaluaciones privadas.",
  "trainings.person.inspect": "Consultar certificaciones y elegibilidad",
  "trainings.person.certificates": "Historial de certificaciones",
  "trainings.person.create": "Registrar certificación",
  "trainings.person.createHint":
    "Registra evidencia verificada y un intervalo de vigencia explícito para esta persona y contexto. El servidor valida las referencias y la vigencia máxima del curso.",
  "trainings.person.uploadPermission":
    "Para registrar la certificación también necesitas permiso para vincular evidencia. Administración puede habilitarlo.",
  "trainings.eligibility.title": "Elegibilidad por capacitación",
  "trainings.eligibility.eligible": "Capacitación vigente",
  "trainings.eligibility.blocked": "Acción bloqueada por capacitación",
  "trainings.eligibility.factual":
    "Resultado factual del servidor para la acción, el contexto y el instante consultados. No concede permiso para ejecutar la acción.",
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
    "Se conservaron tus datos. Las fechas necesitan zona horaria y las referencias deben ser UUID válidos.",
  "trainings.form.failed":
    "No pudimos confirmar el registro. Conservamos tus datos; revisa el historial antes de intentar de nuevo.",
  "trainings.form.saved": "Registro confirmado por el servidor.",
  "trainings.form.review": "Revisé el historial; permitir otro intento",
  "trainings.form.reviewHint":
    "No se enviará otro registro automáticamente. Revisa el historial y confirma antes de volver a guardar.",
  "trainings.eligibility.refreshRequired":
    "Se alcanzó un cambio de vigencia. Actualiza la consulta para confirmar la elegibilidad con el servidor.",
} satisfies AreaCatalog<"trainings">;
