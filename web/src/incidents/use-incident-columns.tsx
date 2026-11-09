import { incidentOriginKey } from "./incident-labels";
import { useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "../data-table/table-types";
import { useFormatDateTime } from "../format/use-format-date-time";
import { StatusPill } from "../ui/StatusPill";
import type { Incident } from "./incidents-query";
import { IncidentStatus } from "./IncidentStatus";
import { IncidentDeadline } from "./IncidentDeadline";
export function useIncidentColumns(): readonly DataTableColumn<Incident>[] {
 const { t } = useTranslation();
 const search = useSearch({ strict: false });
 const format = useFormatDateTime();
 return [
 { id: "code", headerKey: "incidents.workspace.code", cell: row => row.code, link: row => ({ to: "/incidents/$code", params: { code: row.code }, search }) },
 { id: "type", headerKey: "incidents.workspace.type", cell: row => row.type_snapshot?.label ?? t("incidents.workspace.unavailable") },
 { id: "severity", headerKey: "incidents.workspace.severity", cell: row => <StatusPill tone={row.severity === "critical" ? "critical" : "warning"}>{t(`incidents.severity.${row.severity}`)}</StatusPill> },
 { id: "owner", headerKey: "incidents.workspace.owner", cell: row => row.owner_display ?? t("incidents.workspace.unavailable") },
 { id: "origin", headerKey: "incidents.workspace.origin", cell: row => t(incidentOriginKey(row.origin)) },
 { id: "created_at", headerKey: "incidents.workspace.createdAt", cell: row => format(row.created_at) },
 { id: "deadline", headerKey: "incidents.workspace.deadline", cell: row => <IncidentDeadline deadline={row.deadline} /> },
 { id: "state", headerKey: "incidents.workspace.state", cell: row => <IncidentStatus incident={row} /> },
 ];
}
