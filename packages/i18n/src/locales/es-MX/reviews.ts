export const reviews = {
  "reviews.workspace.title": "Bandeja de revisión",
  "reviews.workspace.detail": "Registro original y decisiones",
  "reviews.workspace.ingest": "Resultado original de recepción",
  "reviews.workspace.current": "Decisión actual",
  "reviews.workspace.cause": "Motivo de revisión",
  "reviews.workspace.causeColumn": "Motivo",
  "reviews.workspace.ingestColumn": "Recepción original",
  "reviews.workspace.search": "Buscar eventos o repartidor",
  "reviews.workspace.inReview": "En revisión",
  "reviews.workspace.rejected": "Rechazado",
  "reviews.workspace.pending": "Pendiente",
  "reviews.workspace.accepted": "Aceptado",
  "reviews.workspace.voided": "Anulado",
  "reviews.workspace.event": "Tipo de evento",
  "reviews.workspace.courier": "Referencia del repartidor",
  "reviews.workspace.received": "Recibido el",
  "reviews.workspace.open": "Revisar evento {id}",
  "reviews.workspace.listHint":
    "Se muestran todos los motivos originales de revisión. Las decisiones no cambian el resultado original de recepción.",
  "reviews.workspace.immutable":
    "La captura, evidencia y recepción originales se conservan. Las decisiones se agregan abajo.",
  "reviews.workspace.safety":
    "La aceptación está bloqueada. Un supervisor autorizado debe resolver cada requisito obligatorio de seguridad, permiso, capacitación, zona o autoridad histórica en su flujo correspondiente; una revisión no puede omitirlo.",
  "reviews.workspace.blocker": "Requisito pendiente: {code}",
  "reviews.workspace.original": "Captura, evidencia y procedencia originales",
  "reviews.workspace.history": "Historial de decisiones",
  "reviews.workspace.unknown": "Autor no disponible",
  "reviews.workspace.accept": "Aceptar",
  "reviews.workspace.void": "Anular con motivo",
  "reviews.workspace.openIncident": "Abrir incidente",
  "reviews.workspace.auditOnly": "Solo auditoría; resolución operativa pendiente",
  "reviews.workspace.operational": "Decisión operativa",
  "reviews.workspace.incidentReceipt": "Referencia del incidente creado: {id}",
  "reviews.workspace.receipt": "Recibo del efecto confirmado",
  "reviews.workspace.decisionEvidence": "Referencias de evidencia de la decisión",
  "reviews.workspace.noDecisions":
    "Aún no hay decisiones. Revisa la evidencia original antes de decidir.",
  "reviews.workspace.reason": "Motivo de la decisión",
  "reviews.workspace.reasonHint":
    "Escribe al menos {min} caracteres visibles. Actualiza y revisa la evidencia vigente tras un conflicto o una solicitud interrumpida.",
  "reviews.workspace.refresh": "Actualizar evidencia vigente",
  "reviews.workspace.refreshHint":
    "Tu motivo se conserva. Revisa la evidencia vigente antes de otra decisión deliberada; ninguna solicitud se repetirá automáticamente.",
  "reviews.workspace.saved":
    "Decisión registrada. Consulta la decisión y el recibo del efecto devueltos.",
  "reviews.workspace.denied":
    "Esta vista requiere permiso de lectura y alcance explícito de centros y cuadrantes. Solicita la revisión del acceso a un administrador de la organización.",
  "reviews.workspace.consequence":
    "Antes de aplicar esta decisión, que no se puede deshacer, se comprobarán la evidencia original, la autoridad vigente y los requisitos obligatorios de seguridad.",
  "reviews.workspace.operations": "Operación",
  "reviews.workspace.closeDetail": "Cerrar detalle de revisión",
} as const;
