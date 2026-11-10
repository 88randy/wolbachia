import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import { pageTableData } from "../../data-table/table-data";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import type { TableQueryConfig } from "../../data-table/table-types";
import { Card } from "../../ui/Card";
import { unconfiguredNameColumn } from "./type-column-values";
import { TYPE_PAGE_SIZE, unconfiguredOptions } from "./incident-types-query";
import type { TypeScope, UnconfiguredType } from "./incident-types-query";
import { visibleTypeQuery } from "./type-access";
import { useMemo } from "react";
const TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: TYPE_PAGE_SIZE,
  filters: [],
  sortableIds: [],
  supportsVoided: false,
};
const URL_SCOPE = { prefix: "unconfigured_" };
export function UnconfiguredTypes({
  scope,
  configure,
}: {
  scope: TypeScope;
  configure: (code: string) => void;
}) {
  const { t } = useTranslation();
  const controller = useTableUrlState(TABLE, URL_SCOPE);
  const query = useQuery(unconfiguredOptions(scope, { page: controller.state.page }));
  const columns = useMemo(() => [unconfiguredNameColumn(configure)], [configure]);
  if (query.data?.count === 0) return null;
  const table = {
    caption: t("incidentTypes.page.unconfigured"),
    columns,
    getRowId: (item: UnconfiguredType) => item.id,
    controller,
    data: pageTableData(visibleTypeQuery(query), controller.state.page, TYPE_PAGE_SIZE),
  };
  return (
    <Card title={t("incidentTypes.page.unconfigured")}>
      <DataTable {...table} />
    </Card>
  );
}
