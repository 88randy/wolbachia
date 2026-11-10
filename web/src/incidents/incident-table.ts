import { incidentOriginKey } from "./incident-labels";
import type { TableQueryConfig, TableState } from "../data-table/table-types";
import type { IncidentQuery } from "./incidents-query";
import { INCIDENT_PAGE_SIZE } from "./incidents-query";
const states = ["open", "closed", "voided", "all"] as const;
const severities = ["low", "medium", "high", "critical"] as const;
const origins = [
  "field_event",
  "direct_report",
  "review_decision",
  "inventory_condition",
  "lab_reception",
  "unknown",
] as const;
export const INCIDENT_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: INCIDENT_PAGE_SIZE,
  supportsVoided: false,
  sortableIds: ["code", "severity", "deadline", "created_at"],
  defaultOrdering: "deadline",
  filters: [
    {
      kind: "select",
      key: "state",
      labelKey: "incidents.workspace.state",
      presentation: "segmented",
      defaultValue: "open",
      options: states.map((value) => ({ value, labelKey: `incidents.state.${value}` as const })),
    },
    {
      kind: "select",
      key: "severity",
      labelKey: "incidents.workspace.severity",
      options: severities.map((value) => ({
        value,
        labelKey: `incidents.severity.${value}` as const,
      })),
    },
    {
      kind: "select",
      key: "origin",
      labelKey: "incidents.workspace.origin",
      options: origins.map((value) => ({ value, labelKey: incidentOriginKey(value) })),
    },
    {
      kind: "text",
      key: "type",
      labelKey: "incidents.workspace.type",
      maxLength: 36,
      input: "hidden",
    },
    {
      kind: "text",
      key: "center",
      labelKey: "incidents.workspace.context",
      maxLength: 36,
      input: "hidden",
    },
    {
      kind: "text",
      key: "quadrant",
      labelKey: "incidents.workspace.quadrantId",
      maxLength: 36,
      input: "hidden",
    },
    {
      kind: "select",
      key: "assigned_to_me",
      labelKey: "incidents.workspace.mine",
      options: [{ value: "true", labelKey: "incidents.workspace.mine" }],
    },
    {
      kind: "select",
      key: "overdue",
      labelKey: "incidents.workspace.overdue",
      options: [{ value: "true", labelKey: "incidents.workspace.overdue" }],
    },
  ],
};
/** Only facets supported by the generated reported workspace contract leave the UI. */
export function incidentTableQuery(state: TableState, center?: string): IncidentQuery {
  const filters = state.filters;
  return {
    page: state.page,
    page_size: INCIDENT_PAGE_SIZE,
    state: (filters["state"] === "all"
      ? undefined
      : (filters["state"] ?? "open")) as IncidentQuery["state"],
    severity: filters["severity"] as IncidentQuery["severity"],
    origin: filters["origin"] as IncidentQuery["origin"],
    type: filters["type"],
    center: filters["center"] ?? (center || undefined),
    quadrant: filters["quadrant"],
    assigned_to_me: filters["assigned_to_me"] === "true" ? "true" : undefined,
    overdue: filters["overdue"] === "true" ? "true" : undefined,
    ordering: state.sort
      ? `${state.sort.direction === "desc" ? "-" : ""}${state.sort.id}`
      : undefined,
  };
}
