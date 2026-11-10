import type { AreaCatalog } from "../area.ts";
export const conditions = {
  "conditions.page.title": "Condiciones de lotes biológicos",
  "conditions.action.capture": "Registrar lectura",
  "conditions.action.lot": "Consultar lote",
  "conditions.section.today": "Dos horarios de lectura de hoy",
  "conditions.section.history": "Historial de condiciones",
  "conditions.section.chart": "Lecturas y sus límites históricos",
  "conditions.section.protocol": "Protocolo exacto conservado",
  "conditions.section.observation": "Condiciones observadas",
  "conditions.field.instant": "Fecha y hora con zona",
  "conditions.field.deviceTime": "Hora de observación",
  "conditions.field.receivedTime": "Hora de recepción",
  "conditions.field.newest": "Lectura más reciente primero",
  "conditions.field.localDate": "Fecha local (AAAA-MM-DD)",
  "conditions.field.evaluation": "Evaluación",
  "conditions.field.temperature": "Temperatura (°C)",
  "conditions.field.humidity": "Humedad (%)",
  "conditions.field.allowedTemperature": "Temperatura permitida (°C)",
  "conditions.field.allowedHumidity": "Humedad permitida (%)",
  "conditions.field.reading": "Lectura",
  "conditions.field.minimum": "Mínimo histórico",
  "conditions.field.maximum": "Máximo histórico",
  "conditions.field.slot": "Horario de lectura",
  "conditions.field.firstSlot": "Primer horario",
  "conditions.field.secondSlot": "Segundo horario",
  "conditions.field.timeHint":
    "Escribe fecha y hora ISO con su desfase UTC, por ejemplo 2026-11-06T08:15:00-06:00. Se evalúa en la zona horaria de la organización.",
  "conditions.evaluation.normal": "Dentro del rango",
  "conditions.evaluation.breach": "Fuera del rango",
  "conditions.evaluation.unassessed": "Sin evaluar",
  "conditions.state.unconfigured": "No hay un protocolo completo configurado para este lote.",
  "conditions.state.noWindow": "Sin horario configurado",
  "conditions.state.complete": "Lectura registrada",
  "conditions.state.missing": "Lectura pendiente",
  "conditions.state.noRange": "Sin rango histórico",
  "conditions.state.missingRange":
    "Las lecturas sin límites históricos permanecen en la tabla y se excluyen de la gráfica.",
  "conditions.state.chartScope":
    "La gráfica y la tabla muestran los mismos datos. Cada lectura conserva sus límites permitidos; no corresponden a la configuración de hoy.",
  "conditions.state.hold":
    "Una lectura normal posterior no libera un bloqueo pendiente. Los enlaces a incidentes aparecen solo cuando tienes permiso para consultarlos.",
  "conditions.state.saved": "Lectura guardada",
  "conditions.state.review":
    "Revisa el historial actual antes de otra captura manual. Conservamos tus datos.",
  "conditions.state.invalid": "Revisa este valor y vuelve a guardar.",
  "conditions.state.verifying":
    "Espera el estado autorizado actual antes de registrar una lectura.",
  "conditions.state.offline":
    "No hay conexión. Conserva estos datos y reconecta antes de registrarlos.",
  "conditions.state.uncertain":
    "No pudimos confirmar el resultado. Revisa el historial antes de iniciar otra captura; esta lectura no se reenviará automáticamente.",
} as const satisfies AreaCatalog<"conditions">;
