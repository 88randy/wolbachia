import { useQuery } from "@tanstack/react-query";
import { useSessionIdentity } from "../session/use-session-identity";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { pageTableData } from "../data-table/table-data";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { ListPage } from "../components/templates/ListPage";
import { parametersQueryOptions } from "./rules-query";
import type { RuleParameter } from "./rules-query";
import { PARAMETERS_PAGE_SIZE, PARAMETERS_TABLE } from "./rules-table";
import { useParameterColumns } from "./use-parameter-columns";

const getParameterKey = (parameter: RuleParameter): string => parameter.key;

/**
 * W62, the list: every rule parameter of the organization with the value in force now. Built on
 * the shared `FilterBar` and `DataTable` (the address holds the page). It only reads: a new
 * version is made on the page of each parameter.
 */
export function RuleParametersPage() {
  const { t } = useTranslation();
  const client = useApiClient();
  const controller = useTableUrlState(PARAMETERS_TABLE);
  const columns = useParameterColumns();
  const identity = useSessionIdentity();
  const query = useQuery(parametersQueryOptions(client, identity, controller.state));
  return (
    <ListPage title={t("rules.page.title")} description={t("rules.page.hint")}>
      <FilterBar controller={controller} />
      <DataTable
        caption={t("rules.table.caption")}
        columns={columns}
        getRowId={getParameterKey}
        controller={controller}
        data={pageTableData(query, controller.state.page, PARAMETERS_PAGE_SIZE)}
      />
    </ListPage>
  );
}
