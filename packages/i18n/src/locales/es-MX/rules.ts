/** Mexican Spanish messages of the `rules` area (W62, versioned rule parameters). Source of the `rules.*` key list. */
import type { AreaCatalog } from "../area.ts";

export const rules = {
  // Parameter list.
  "rules.page.title": "Parámetros de reglas",
  "rules.page.hint":
    "Cada cambio crea una versión con fecha de vigencia. Lo anterior queda en el historial.",
  "rules.table.caption": "Parámetros de reglas de la organización",
  "rules.column.parameter": "Parámetro",
  "rules.column.key": "Clave",
  "rules.column.unit": "Unidad",
  "rules.column.value": "Valor actual",
  "rules.column.since": "Vigente desde",
  "rules.column.next": "Próximo cambio",
  "rules.cell.none": "Ninguno",
  "rules.status.notConfigured": "Sin configurar",

  // Names of the parameters the seed creates. A key the web does not know shows its own code.
  "rules.param.labCountPlausibilityLimit": "Umbral de plausibilidad del conteo de huevos",
  "rules.param.labRecountSamplePer100": "Conteos seleccionados por cada 100 primeros conteos",
  "rules.param.maxDistanceToPoint": "Distancia máxima al punto",
  "rules.param.minDistanceSameBlock": "Distancia mínima entre ovitrampas de una manzana",
  "rules.param.speedLock": "Velocidad que bloquea la captura",
  "rules.param.speedUnlock": "Segundos para desbloquear la captura",
  "rules.param.clockSkewReview": "Desfase de reloj que manda un registro a revisión",
  "rules.param.closedHouseWeeks": "Semanas de casa cerrada para reubicar",
  "rules.param.incidentsToRelocate": "Incidencias para reubicar",
  "rules.param.fuelEfficiencyMin": "Rendimiento mínimo de combustible",
  "rules.param.fuelEfficiencyMax": "Rendimiento máximo de combustible",
  "rules.param.sessionIdle": "Inactividad que cierra la sesión",
  "rules.param.reminderBeforeEnd": "Aviso antes del fin de la jornada",
  "rules.param.maxPaddleReuses": "Reutilizaciones máximas de la papeleta",
  "rules.param.revisitInterval": "Intervalo entre revisitas",

  // Units of the API (`m`, `km_h`...). Written out, so no number needs plural agreement.
  "rules.unit.meters": "metros",
  "rules.unit.kmPerHour": "km/h",
  "rules.unit.seconds": "segundos",
  "rules.unit.minutes": "minutos",
  "rules.unit.days": "días",
  "rules.unit.weeks": "semanas",
  "rules.unit.count": "veces",
  "rules.unit.kmPerLiter": "km/l",

  // Parameter page.
  "rules.detail.back": "Volver a parámetros",
  "rules.detail.key": "Clave",
  "rules.detail.loading": "Cargando el parámetro",
  "rules.detail.refreshFailed":
    "No pudimos actualizar este parámetro. Lo que ves puede no estar al día; tu borrador sigue aquí.",
  "rules.summary.title": "Valor vigente",
  "rules.summary.value": "Valor actual",
  "rules.summary.since": "Vigente desde",
  "rules.summary.next": "Próximo cambio programado",
  "rules.summary.range": "Valores permitidos",
  "rules.range.between": "De {min} a {max}",
  "rules.range.atLeast": "Desde {min}",
  "rules.range.atMost": "Hasta {max}",
  "rules.range.none": "Sin límites",

  // New version form.
  "rules.form.title": "Nueva versión",
  "rules.form.hint": "No se sobrescribe nada: el valor actual queda en el historial.",
  "rules.form.value": "Valor nuevo",
  "rules.form.valueHint": "Solo números; usa punto para los decimales.",
  "rules.form.effectiveFrom": "Vigente desde",
  "rules.form.effectiveHint":
    "Hoy aplica de inmediato; una fecha futura, desde las 00:00 de la zona horaria de la organización.",
  "rules.form.reason": "Motivo del cambio",
  "rules.form.required": "obligatorio",
  "rules.form.scheduledNote": "Ya hay un cambio programado para el {date}.",
  "rules.form.submit": "Guardar versión",
  "rules.form.busy": "Guardando…",
  "rules.form.saved": "Versión guardada. Ya aparece en el historial.",
  "rules.compare.title": "Antes y después",
  "rules.compare.before": "Antes",
  "rules.compare.after": "Después",
  "rules.compare.from": "Desde el {date}",

  // Why a field or the whole form was refused (codes of docs/api-conventions.md, "Rule parameters").
  "rules.error.title": "No pudimos guardar la versión",
  "rules.error.valueRequired": "Escribe el valor nuevo.",
  "rules.error.valueInvalid":
    "Escribe solo números, con punto si lleva decimales (hasta 3 decimales).",
  "rules.error.notInteger": "Este parámetro solo admite números enteros.",
  "rules.error.range": "El valor debe estar entre {min} y {max}.",
  "rules.error.atLeast": "El valor debe ser {min} o más.",
  "rules.error.atMost": "El valor debe ser {max} o menos.",
  "rules.error.dateRequired": "Elige desde qué fecha aplica.",
  "rules.error.dateInPast": "La fecha no puede ser anterior a hoy. Elige hoy o una fecha futura.",
  "rules.error.dateTooFar": "Esa fecha queda muy lejos. Elige una dentro del próximo año.",
  "rules.error.dateTaken":
    "Ya hay una versión programada para esa fecha. Anúlala o elige otra fecha.",
  "rules.error.reasonRequired": "Cuéntanos por qué cambia el valor.",
  "rules.error.reasonTooLong": "El motivo es muy largo. Resúmelo un poco.",

  // History.
  "rules.history.title": "Historial de versiones",
  "rules.history.hint": "Solo lectura: cada versión conserva quién la creó, cuándo y por qué.",
  "rules.history.caption": "Versiones del parámetro, de la más reciente a la más antigua",
  "rules.history.value": "Valor",
  "rules.history.effective": "Vigente desde",
  "rules.history.status": "Estado",
  "rules.history.reason": "Motivo",
  "rules.history.author": "Autor",
  "rules.history.created": "Registrada",
  "rules.history.actions": "Acciones",
  "rules.history.void": "Anular",
  "rules.history.voidLabel": "Anular la versión del {date}",
  "rules.history.voidBlocked":
    "Esta versión ya entró en vigor: queda como historial y no se puede anular.",
  "rules.history.voidDone": "Versión anulada. Sigue en el historial, tachada.",
  "rules.history.system": "Sistema",
  "rules.status.scheduled": "Programada",
  "rules.status.inForce": "Vigente",
  "rules.status.superseded": "Anterior",
  "rules.status.voided": "Anulada",
  "rules.param.maxGpsAccuracyM": "Precisión GPS máxima (m)",
} as const satisfies AreaCatalog<"rules">;
