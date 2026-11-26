import type { TFunction } from "i18next";
import { Button } from "../../ui/Button";
import { StatusPill } from "../../ui/StatusPill";
import type { DataTableColumn } from "../../data-table/table-types";
import type { IncidentType, UnconfiguredType } from "./incident-types-query";
export function typeNameColumn(edit: (code: string) => void): DataTableColumn<IncidentType> {
  return {
    id: "code",
    headerKey: "incidentTypes.column.type",
    cell: (item) => (
      <Button
        id={`type-edit-${item.code}`}
        variant="ghost"
        onClick={() => {
          edit(item.code);
        }}
      >
        {item.label}
      </Button>
    ),
  };
}
export function typeSeverityColumn(t: TFunction): DataTableColumn<IncidentType> {
  return {
    id: "severity",
    headerKey: "incidentTypes.field.severity",
    cell: (item) => (
      <StatusPill
        tone={
          item.severity === "critical"
            ? "critical"
            : item.severity === "high"
              ? "warning"
              : "neutral"
        }
      >
        {t(`incidents.severity.${item.severity}`)}
      </StatusPill>
    ),
  };
}
export function typeSupervisorColumn(t: TFunction): DataTableColumn<IncidentType> {
  return {
    id: "supervisor",
    headerKey: "incidentTypes.field.supervisor",
    cell: (item) => item.supervisor_display ?? t("incidentTypes.owner.unavailable"),
  };
}
export function typeSlaColumn(language: string): DataTableColumn<IncidentType> {
  return {
    id: "supervisor_sla_seconds",
    headerKey: "incidentTypes.field.supervisorSla",
    align: "end",
    cell: (item) => new Intl.NumberFormat(language).format(item.supervisor_sla_seconds),
  };
}
export function typeStateColumn(t: TFunction): DataTableColumn<IncidentType> {
  return {
    id: "is_active",
    headerKey: "incidentTypes.field.active",
    cell: (item) => (
      <StatusPill tone={item.is_active ? "success" : "neutral"}>
        {t(
          item.is_other
            ? "incidentTypes.status.protected"
            : item.is_active
              ? "incidentTypes.status.active"
              : "incidentTypes.status.inactive",
        )}
      </StatusPill>
    ),
  };
}
export function unconfiguredNameColumn(
  configure: (code: string) => void,
): DataTableColumn<UnconfiguredType> {
  return {
    id: "code",
    headerKey: "incidentTypes.column.type",
    cell: (item) => (
      <Button
        id={`type-configure-${item.code}`}
        variant="ghost"
        onClick={() => {
          configure(item.code);
        }}
      >
        {item.label}
      </Button>
    ),
  };
}
