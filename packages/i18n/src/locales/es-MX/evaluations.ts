import type { AreaCatalog } from "../area.ts";
export const evaluations = {
  "evaluations.history.attemptTable": "Detalle de intentos",
  "evaluations.history.records": "Registros de evaluación",
  "evaluations.rubric.versionHistory": "Versiones de rúbrica",
  "evaluations.form.newRecord": "Nueva evaluación",
  "evaluations.history.provenanceGap":
    "La respuesta de intentos no incluye la identidad de su rúbrica original. Consulta la fila de la evaluación y su historial de versiones; no uses la rúbrica seleccionada para una captura nueva como referencia de estos intentos.",
  "evaluations.page.title": "Cédulas de evaluación",
  "evaluations.page.people": "Personal",
  "evaluations.page.trainings": "Capacitaciones",
  "evaluations.page.hint":
    "Registra observaciones y consulta resultados con su rúbrica original. El resultado se calcula automáticamente; una evaluación no certifica una capacitación.",
  "evaluations.page.denied":
    "No tienes acceso a este contexto. Pide a administración que revise tus permisos y alcance.",
  "evaluations.page.private":
    "El historial requiere permiso de lectura de evaluaciones. Tu permiso de captura no concede acceso al historial.",
  "evaluations.page.identifiers":
    "Este servicio todavía no ofrece un directorio autorizado de personas y contextos para esta tarea. Usa sus identificadores exactos; no se buscan nombres ni datos privados.",
  "evaluations.rubric.percent": "%",
  "evaluations.rubric.separator": " · ",
  "evaluations.rubric.title": "Rúbrica y versiones",
  "evaluations.rubric.code": "Código exacto de rúbrica",
  "evaluations.rubric.lookup": "Consultar rúbrica",
  "evaluations.rubric.version": "Versión de rúbrica",
  "evaluations.rubric.select": "Usar esta versión",
  "evaluations.rubric.threshold": "Umbral de aprobación",
  "evaluations.rubric.effective": "Vigente desde",
  "evaluations.rubric.unconfigured":
    "Falta configurar una rúbrica válida. Administración debe publicar pesos y comprobaciones críticas antes de capturar.",
  "evaluations.rubric.choose":
    "Selecciona explícitamente la versión que corresponde a esta observación. Las versiones anteriores conservan sus propios pesos.",
  "evaluations.rubric.checks": "Comprobaciones críticas",
  "evaluations.form.title": "Nueva evaluación",
  "evaluations.form.save": "Guardar cédula",
  "evaluations.form.confirm":
    "Registrar esta observación conserva un intento inmutable y puede originar un aviso de capacitación. Revisa persona, contexto, rúbrica y respuestas.",
  "evaluations.form.review": "Revisar y guardar",
  "evaluations.form.invalid":
    "Revisa los identificadores, la fecha con zona horaria y los valores de 0 a 100. Conservamos tus campos.",
  "evaluations.form.failed":
    "No pudimos confirmar el registro. Conservamos los campos. Consulta el historial antes de iniciar otro intento; no reenviamos automáticamente.",
  "evaluations.form.retry": "Ya revisé el historial; habilitar otro intento",
  "evaluations.form.offline":
    "Sin conexión. Puedes conservar los campos; vuelve a conectarte para registrar la observación.",
  "evaluations.form.scores":
    "Puntajes normalizados de 0 a 100. Un campo sin contestar queda incompleto; no se redistribuye su peso.",
  "evaluations.form.blocked":
    "Selecciona una rúbrica configurada y un contexto permitido. Administración puede revisar la configuración y el alcance.",
  "evaluations.field.subject": "Persona",
  "evaluations.field.center": "Centro",
  "evaluations.field.quadrant": "Cuadrante (opcional)",
  "evaluations.field.observed": "Fecha de observación",
  "evaluations.field.observedTime": "Hora",
  "evaluations.field.instantHint":
    "Usa una fecha ISO 8601 con Z o desfase explícito, por ejemplo 2026-11-09T12:00:00-06:00.",
  "evaluations.field.presentation": "Presentación",
  "evaluations.field.execution": "Ejecución",
  "evaluations.field.coverage": "Cobertura",
  "evaluations.field.unanswered": "Sin contestar",
  "evaluations.field.yes": "Cumple",
  "evaluations.field.no": "Falla crítica",
  "evaluations.result.title": "Resultado",
  "evaluations.result.score": "Puntaje calculado",
  "evaluations.result.pass": "Aprobada",
  "evaluations.result.low": "Resultado bajo",
  "evaluations.result.incomplete": "Incompleta",
  "evaluations.result.criticalFailure": "Falla crítica de seguridad",
  "evaluations.result.saved": "Evaluación registrada.",
  "evaluations.result.sequence": "Secuencia de terminación",
  "evaluations.history.title": "Historial de evaluaciones",
  "evaluations.history.attempts": "Intentos conservados",
  "evaluations.history.open": "Consultar intentos",
  "evaluations.history.id": "Evaluación",
  "evaluations.history.revision": "Revisión",
  "evaluations.history.author": "Autor",
  "evaluations.history.recorded": "Registrada",
  "evaluations.history.reason": "Motivo de corrección o anulación",
  "evaluations.history.voided": "Anulada",
  "evaluations.history.raw": "Observaciones originales",
  "evaluations.history.unavailable": "No disponible en esta respuesta",
  "evaluations.history.correction": "Corregir o anular",
  "evaluations.history.correctionGap":
    "Esta información todavía no está disponible. Administración debe solicitar esa interfaz; el historial se conserva.",
  "evaluations.notice.title": "Aviso a recursos humanos",
  "evaluations.notice.policies": "Versiones de configuración del aviso",
  "evaluations.notice.policyId": "Configuración del aviso",
  "evaluations.notice.recipient": "Destinatario",
  "evaluations.notice.noQuadrant": "Sin cuadrante aplicable",
  "evaluations.notice.historyHint":
    "Versiones conservadas para este alcance y filtros. Una versión anterior no demuestra que el destinatario siga activo ni que se haya publicado o entregado un aviso.",
  "evaluations.notice.unconfigured":
    "No hay configuración de destinatario visible para este contexto y filtros. Administración debe configurar o revisar una membresía destinataria activa; la entrega del aviso no está confirmada.",
  "evaluations.notice.gap":
    "Se registra la causa al tercer resultado adverso consecutivo. Administración debe revisar la configuración y el canal; guardar una evaluación no confirma el envío.",
} as const satisfies AreaCatalog<"evaluations">;
