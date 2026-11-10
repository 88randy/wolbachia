import type { AreaCatalog } from "../area.ts";
export const shift = {
  "shift.page.title": "Validar jornadas",
  "shift.page.detail": "Revisar jornada",
  "shift.page.listHint":
    "Abre una jornada para revisar su cierre y registrar una decisión. El filtro Estado permite consultar solo las cerradas.",
  "shift.page.summary": "Resumen de la jornada",
  "shift.page.timeline": "Línea de tiempo disponible",
  "shift.page.history": "Historial de validación",
  "shift.field.reference": "Referencia de jornada",
  "shift.field.courier": "Referencia del repartidor",
  "shift.field.motorcycle": "Motocicleta",
  "shift.field.lifecycle": "Estado",
  "shift.field.opened": "Apertura (hora del teléfono)",
  "shift.field.closed": "Cierre (hora del teléfono)",
  "shift.field.odometerOpen": "Odómetro al abrir (km)",
  "shift.field.odometerClose": "Odómetro al cerrar (km)",
  "shift.field.reason": "Motivo (obligatorio)",
  "shift.field.reasonHint":
    "Mínimo {min} caracteres visibles y máximo {max} caracteres en total. El motivo queda en el historial.",
  "shift.field.author": "Referencia del autor",
  "shift.field.revision": "Revisión",
  "shift.field.unavailable": "No disponible",
  "shift.status.open": "Abierta",
  "shift.status.closed": "Cerrada",
  "shift.status.pending": "Por validar",
  "shift.status.approved": "Aprobada",
  "shift.status.observed": "Observada",
  "shift.status.outdated": "Aprobación desactualizada",
  "shift.action.approve": "Aprobar jornada",
  "shift.action.observe": "Enviar observación",
  "shift.action.refresh": "Actualizar jornada",
  "shift.action.approveHint":
    "Aprueba la jornada completa y registra tu motivo. La decisión queda en el historial; no modifica las capturas originales.",
  "shift.action.observeHint":
    "Registra una observación de la jornada completa con un motivo para el repartidor. No modifica las capturas originales.",
  "shift.gap.summary":
    "El resumen de puntos, lecturas, papeleta presente y huevos Sí/No, incidentes, distancia y alertas con umbral y versión todavía no está disponible. Revisa la información de campo antes de decidir.",
  "shift.gap.track":
    "Recorrido GPS no disponible. La jornada no incluye coordenadas ni eventos de visita para mostrar el mapa. Esta lista contiene únicamente la apertura y el cierre disponibles.",
  "shift.gap.points":
    "El historial de los puntos (W4) todavía no está disponible en esta aplicación. Aquí se muestran las decisiones guardadas de la jornada.",
  "shift.history.empty":
    "Esta jornada aún no tiene decisiones. Revisa la información disponible antes de validar.",
  "shift.history.saved": "Decisión guardada. Actualizando el historial de la jornada.",
  "shift.blocker.open":
    "La jornada sigue abierta. El repartidor debe cerrarla desde su teléfono antes de que supervisión pueda validarla.",
  "shift.blocker.source":
    "Las capturas de apertura o cierre no son efectivas. Supervisión debe resolver su revisión antes de aprobar.",
  "shift.blocker.review":
    "Hay capturas pendientes de revisión. Supervisión debe resolverlas antes de aprobar.",
  "shift.blocker.motorcycle":
    "La motocicleta tiene un bloqueo de seguridad. El personal autorizado debe resolverlo antes de aprobar.",
  "shift.blocker.incident":
    "Un incidente mantiene un bloqueo de seguridad. El personal autorizado debe resolverlo antes de aprobar.",
  "shift.blocker.scope":
    "No se pudo comprobar el alcance completo de la jornada. Administración debe revisar los permisos y supervisión debe actualizar la jornada.",
  "shift.blocker.unknown":
    "La jornada tiene un bloqueo. Supervisión debe revisar sus pendientes antes de aprobar.",
  "shift.blocker.refresh":
    "Actualiza y revisa la jornada antes de enviar una decisión. Supervisión necesita una lectura vigente sin errores.",
  "shift.error.tooShort": "Escribe un motivo con la longitud mínima indicada.",
  "shift.error.tooLong": "El motivo supera la longitud máxima indicada.",
  "shift.error.invalidCharacters":
    "Quita los caracteres de control del motivo e inténtalo de nuevo.",
  "shift.error.invalid": "No se aceptó el motivo. Revísalo e inténtalo de nuevo.",
  "shift.error.conflict":
    "La jornada cambió. Conservamos tu motivo. Cierra este diálogo, actualiza y revisa el historial antes de volver a abrir la acción.",
  "shift.error.uncertain":
    "No pudimos confirmar la decisión. Conservamos tu motivo. Cierra este diálogo y actualiza el historial antes de decidir si necesitas enviarla de nuevo.",
  "shift.error.denied":
    "Ya no tienes acceso a esta acción. Cierra este diálogo y actualiza la jornada; consulta a administración si necesitas permisos.",
  "shift.error.session":
    "La sesión cambió. Inicia sesión y revisa la jornada antes de volver a enviar tu decisión.",
} as const satisfies AreaCatalog<"shift">;
