import type { AreaCatalog } from "../area.ts";
export const incidentTypes = {
  "incidentTypes.page.title": "Tipos de incidente",
  "incidentTypes.page.create": "Nuevo tipo",
  "incidentTypes.page.unconfigured": "Tipos pendientes de configurar",
  "incidentTypes.form.configure": "Configurar tipo",
  "incidentTypes.form.chooseSeverity": "Selecciona la severidad",
  "incidentTypes.form.retainedBlockers":
    "Esta configuración incluye bloqueos administrados por el sistema. Se conservan sin cambios al editar otros campos.",
  "incidentTypes.form.offline":
    "No hay conexión. Conservamos tu captura; reconecta y verifica la configuración vigente antes de guardar.",
  "incidentTypes.form.verifying":
    "Estamos verificando la configuración autorizada. Espera una respuesta vigente antes de guardar.",
  "incidentTypes.field.code": "Código exacto",
  "incidentTypes.field.label": "Nombre",
  "incidentTypes.field.icon": "Ícono",
  "incidentTypes.field.severity": "Severidad por defecto",
  "incidentTypes.field.supervisor": "Supervisor responsable",
  "incidentTypes.field.coordinator": "Coordinador responsable",
  "incidentTypes.field.terminal": "Responsable terminal",
  "incidentTypes.field.supervisorSla": "Respuesta del supervisor (segundos)",
  "incidentTypes.field.coordinatorSla": "Respuesta del coordinador (segundos)",
  "incidentTypes.field.reportEvidence": "Fotos para reportar",
  "incidentTypes.field.closeEvidence": "Fotos para cerrar",
  "incidentTypes.field.blockers": "Mientras siga abierto, bloquea",
  "incidentTypes.field.active": "Tipo activo",
  "incidentTypes.form.label": "Configuración del tipo",
  "incidentTypes.form.save": "Guardar versión",
  "incidentTypes.form.saved": "Versión guardada",
  "incidentTypes.form.revision": "Revisión vigente:",
  "incidentTypes.form.review": "Revisar configuración vigente",
  "incidentTypes.form.retainedRules":
    "Los cambios aplican a incidentes nuevos. Los anteriores conservan la versión con la que se crearon.",
  "incidentTypes.form.reminder":
    "Escalamiento: supervisor, coordinador y responsable terminal. En el último nivel se envía un recordatorio cada hora hasta su resolución.",
  "incidentTypes.form.protectedOther":
    "Otro siempre existe: su nombre, ícono y estado activo están protegidos.",
  "incidentTypes.form.noBlockers": "Sin bloqueos configurados",
  "incidentTypes.owner.search": "Buscar responsables elegibles",
  "incidentTypes.owner.choose": "Selecciona una persona responsable",
  "incidentTypes.owner.skip": "Omitir este nivel",
  "incidentTypes.owner.unavailable": "Responsable no disponible; selecciona una persona elegible.",
  "incidentTypes.history.title": "Historial de configuración",
  "incidentTypes.history.empty":
    "Todavía no hay versiones. Guarda la configuración para crear la primera.",
  "incidentTypes.error.field": "Revisa este campo y vuelve a guardar.",
  "incidentTypes.error.validation": "Revisa los campos señalados. Tu captura sigue disponible.",
  "incidentTypes.error.conflict":
    "La configuración cambió o no admite esta acción. Revisa la versión vigente antes de volver a guardar.",
  "incidentTypes.error.terminal":
    "Una persona administradora debe configurar un responsable terminal activo y elegible. Selecciona responsables vigentes o elimina los niveles opcionales no disponibles.",
  "incidentTypes.status.active": "Activo",
  "incidentTypes.status.inactive": "Inactivo",
  "incidentTypes.status.protected": "Siempre existe",
} as const satisfies AreaCatalog<"incidentTypes">;
