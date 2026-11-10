export const closure = {
  "closure.page.title": "Cierre del cuadrante {code}",
  "closure.crumb": "Cierre",
  "closure.page.purpose":
    "Revisa todos los bloqueos antes de cerrar la versión actual del cuadrante.",
  "closure.readiness.title": "Preparación para el cierre",
  "closure.blocker.title": "Bloqueos pendientes",
  "closure.readiness.ready": "No quedan bloqueos. Puedes revisar y confirmar el cierre.",
  "closure.readiness.blocked":
    "Cada bloqueo debe resolverlo quien tenga el permiso indicado. Actualiza después de su resolución.",
  "closure.blocker.unblocker":
    "Lo resuelve la persona de supervisión responsable de este pendiente.",
  "closure.blocker.reference": "Referencia: {reference}",
  "closure.readiness.version": "Versión: {version} · revisión {revision}",
  "closure.actions.refresh": "Actualizar preparación",
  "closure.actions.close": "Cerrar cuadrante",
  "closure.actions.confirm": "Confirmar cierre",
  "closure.confirm.title": "Cerrar esta versión del cuadrante",
  "closure.confirm.consequence":
    "El cierre es definitivo para esta versión. Impide nuevas tareas en ella y no borra ni modifica los registros históricos.",
  "closure.write.conflict":
    "La preparación cambió. Se actualizó la evidencia; revisa todos los bloqueos y vuelve a confirmar de forma explícita.",
  "closure.write.changed":
    "La evidencia cambió desde que abriste la confirmación. Actualiza y vuelve a revisar el cierre.",
  "closure.readiness.closed": "Esta versión del cuadrante ya está cerrada.",
  "closure.receipt.reference": "Cierre registrado: {reference}",
  "closure.receipt.audit": "Registrado por {author} · {time}",
  "closure.receipt.unknownAuthor": "Autor no disponible",
  "closure.write.offline":
    "Sin conexión. Conserva la revisión y actualiza al reconectarte antes de cerrar.",
  "closure.write.failure":
    "No se pudo confirmar el cierre. Actualiza la preparación y revisa el resultado antes de volver a intentarlo.",
  "closure.blocker.unknown": "Bloqueo pendiente: {reason}",
  "closure.blocker.removalUnconfirmed": "Retiro sin confirmar",
  "closure.blocker.removalUnrecovered": "Ovitrampa no recuperada",
  "closure.blocker.relocationPending": "Reubicación sin decisión",
  "closure.blocker.removalReviewPending": "Retiro pendiente de revisión",
  "closure.blocker.relocationReviewPending": "Reubicación pendiente de revisión",
  "closure.blocker.incidentQuadrantClosure": "Incidente que bloquea el cierre",
} as const;
