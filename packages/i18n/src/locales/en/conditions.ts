import type { AreaCatalog } from "../area.ts";
export const conditions = {
  "conditions.page.title": "Biological lot conditions",
  "conditions.action.capture": "Record reading",
  "conditions.action.lot": "View lot",
  "conditions.section.today": "Today's two reading windows",
  "conditions.section.history": "Condition history",
  "conditions.section.chart": "Readings and their historical limits",
  "conditions.section.protocol": "Exact retained protocol",
  "conditions.section.observation": "Observed conditions",
  "conditions.field.instant": "Date and time with zone",
  "conditions.field.deviceTime": "Observed at",
  "conditions.field.receivedTime": "Received at",
  "conditions.field.newest": "Newest reading first",
  "conditions.field.localDate": "Local date (YYYY-MM-DD)",
  "conditions.field.evaluation": "Evaluation",
  "conditions.field.temperature": "Temperature (°C)",
  "conditions.field.humidity": "Humidity (%)",
  "conditions.field.allowedTemperature": "Allowed temperature (°C)",
  "conditions.field.allowedHumidity": "Allowed humidity (%)",
  "conditions.field.reading": "Reading",
  "conditions.field.minimum": "Historical minimum",
  "conditions.field.maximum": "Historical maximum",
  "conditions.field.slot": "Reading window",
  "conditions.field.firstSlot": "First window",
  "conditions.field.secondSlot": "Second window",
  "conditions.field.timeHint":
    "Enter an ISO date and time with its UTC offset, for example 2026-11-06T08:15:00-06:00. Evaluation uses the organization's time zone.",
  "conditions.evaluation.normal": "Within range",
  "conditions.evaluation.breach": "Out of range",
  "conditions.evaluation.unassessed": "Not assessed",
  "conditions.state.unconfigured": "No complete protocol is configured for this lot.",
  "conditions.state.noWindow": "No configured window",
  "conditions.state.complete": "Reading recorded",
  "conditions.state.missing": "Reading missing",
  "conditions.state.noRange": "No historical range",
  "conditions.state.missingRange":
    "Readings without historical limits remain in the table and are excluded from the chart.",
  "conditions.state.chartScope":
    "Chart and table show the same server page. Each reading retains its own allowed limits; these are not today's configuration.",
  "conditions.state.hold":
    "A later normal reading does not clear an unresolved hold. Incident links appear only when you can read them.",
  "conditions.state.saved": "Reading saved on the server",
  "conditions.state.review":
    "Review the current server history before another manual capture. Your input has been preserved.",
  "conditions.state.invalid": "Review this value and save again.",
  "conditions.state.verifying":
    "Wait for the current authorized status before recording a reading.",
  "conditions.state.offline": "You are offline. Keep this input and reconnect before recording it.",
  "conditions.state.uncertain":
    "The result could not be confirmed. Review the server history before starting another capture; this reading will not be retried automatically.",
} as const satisfies AreaCatalog<"conditions">;
