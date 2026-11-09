import type { Schemas } from "@wolbachia/api-client";
const ORIGINS = {
  field_event: "incidents.origin.fieldEvent",
  direct_report: "incidents.origin.directReport",
  review_decision: "incidents.origin.reviewDecision",
  inventory_condition: "incidents.origin.inventoryCondition",
  lab_reception: "incidents.origin.labReception",
  unknown: "incidents.origin.unknown",
} as const;
export function incidentOriginKey(origin: Schemas["OriginEnum"]) {
  return ORIGINS[origin];
}
export function incidentEventKey(action: Schemas["IncidentEventActionEnum"]) {
  return action === "change_severity" ? "incidents.event.changeSeverity" : `incidents.event.${action}` as const;
}
