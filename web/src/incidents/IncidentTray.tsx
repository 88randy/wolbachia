import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "../data-table/DataTable";
import { IncidentFilters } from "./IncidentFilters";
import { pageTableData } from "../data-table/table-data";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { InlineNotice } from "../ui/InlineNotice";
import { incidentListOptions, INCIDENT_PAGE_SIZE } from "./incidents-query";
import type { Incident } from "./incidents-query";
import { useIncidentScope } from "./use-incident-scope";
import { INCIDENT_TABLE, incidentTableQuery } from "./incident-table";
import { useIncidentColumns } from "./use-incident-columns";
import { incidentVoidInfo } from "./incident-void-info";
export function IncidentTray() {
  const { t } = useTranslation();
  const scope = useIncidentScope();
  const controller = useTableUrlState(INCIDENT_TABLE);
  const query = useQuery(
    incidentListOptions(scope, incidentTableQuery(controller.state, scope.identity.activeCenter)),
  );
  const columns = useIncidentColumns();
  const rows = query.data?.results.filter((row): row is Incident => "code" in row) ?? [];
  const table = pageTableData(
    { ...query, data: query.data ? { ...query.data, results: rows } : undefined },
    controller.state.page,
    INCIDENT_PAGE_SIZE,
  );
  return (
    <>
      <InlineNotice tone="info">{t("incidents.workspace.defaultView")}</InlineNotice>
      <IncidentFilters scope={scope} controller={controller} />
      <DataTable
        caption={t("incidents.workspace.title")}
        columns={columns}
        getRowId={(row) => row.id}
        controller={controller}
        data={table}
        voidOf={(row) => incidentVoidInfo(row, t("incidents.workspace.unavailable"))}
      />
      <p>{t("incidents.workspace.orderHint")}</p>
    </>
  );
}
