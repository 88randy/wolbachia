import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import type { RowData } from "@tanstack/react-table";
import type { MessageKey } from "@wolbachia/i18n";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ListPage } from "../components/templates/ListPage";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { pageTableData } from "../data-table/table-data";
import type { DataTableColumn, TableQueryConfig, TableState } from "../data-table/table-types";
import { useTableUrlState } from "../data-table/use-table-url-state";
import type { LabScope } from "./lab-query";
import { useLabScope } from "./use-lab-scope";

interface Page<Row> {
  count: number;
  results: Row[];
}

interface LabListScreenProps<Row extends RowData> {
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  table: TableQueryConfig;
  options: (scope: LabScope, state: TableState) => UseQueryOptions<Page<Row>, Error, Page<Row>>;
  columns: readonly DataTableColumn<Row>[];
  getRowId: (row: Row) => string;
  rowActions?: (row: Row) => ReactNode;
  actions?: ReactNode;
}

/** Shared list screen of the lab area: header, URL filters and a server-paged table. */
export function LabListScreen<Row extends RowData>(props: LabListScreenProps<Row>) {
  const { titleKey, descriptionKey, table, options, columns, getRowId, rowActions, actions } =
    props;
  const { t } = useTranslation();
  const scope = useLabScope();
  const controller = useTableUrlState(table);
  const query = useQuery(options(scope, controller.state));
  return (
    <ListPage title={t(titleKey)} description={t(descriptionKey)} actions={actions}>
      <FilterBar controller={controller} />
      <DataTable
        caption={t(titleKey)}
        columns={columns}
        getRowId={getRowId}
        controller={controller}
        data={pageTableData(query, controller.state.page, table.pageSize)}
        rowActions={rowActions}
      />
    </ListPage>
  );
}
