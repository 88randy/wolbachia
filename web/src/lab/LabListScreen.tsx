import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import type { RowData } from "@tanstack/react-table";
import type { MessageKey } from "@wolbachia/i18n";
import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ListPage } from "../components/templates/ListPage";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { pageTableData } from "../data-table/table-data";
import type { DataTableColumn, TableQueryConfig, TableState } from "../data-table/table-types";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { LabDetailSheet } from "./LabDetailSheet";
import type { LabDetail } from "./LabDetailSheet";
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
  /** Opens the row's detail in a side sheet when its first cell is activated. */
  detailOf?: (row: Row) => LabDetail;
  /** The "⋯" menu of the row. */
  rowActions?: (row: Row) => ReactNode;
  actions?: ReactNode;
}

/** The first cell of a row opens its detail; it is a real button (keyboard and screen readers). */
function withDetailOpener<Row extends RowData>(
  columns: readonly DataTableColumn<Row>[],
  open: (row: Row) => void,
): DataTableColumn<Row>[] {
  return columns.map((column, index) =>
    index === 0
      ? {
          ...column,
          cell: (row: Row) => (
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent p-0 text-left font-semibold text-action hover:underline"
              onClick={() => {
                open(row);
              }}
            >
              {column.cell(row)}
            </button>
          ),
        }
      : column,
  );
}

function useRowDetail<Row extends RowData>(
  base: readonly DataTableColumn<Row>[],
  detailOf: ((row: Row) => LabDetail) | undefined,
) {
  const [detail, setDetail] = useState<LabDetail | null>(null);
  const columns = detailOf
    ? withDetailOpener(base, (row) => {
        setDetail(detailOf(row));
      })
    : [...base];
  return {
    columns,
    detail,
    close: () => {
      setDetail(null);
    },
  };
}

/** Shared list screen of the lab area: header, URL filters, a server-paged table and a row detail. */
export function LabListScreen<Row extends RowData>(props: LabListScreenProps<Row>) {
  const { titleKey, descriptionKey, table, options, getRowId, detailOf } = props;
  const { t } = useTranslation();
  const scope = useLabScope();
  const controller = useTableUrlState(table);
  const query = useQuery(options(scope, controller.state));
  const { columns, detail, close } = useRowDetail(props.columns, detailOf);
  return (
    <ListPage title={t(titleKey)} description={t(descriptionKey)} actions={props.actions}>
      <FilterBar controller={controller} />
      <DataTable
        caption={t(titleKey)}
        columns={columns}
        getRowId={getRowId}
        controller={controller}
        data={pageTableData(query, controller.state.page, table.pageSize)}
        rowActions={props.rowActions}
      />
      <LabDetailSheet detail={detail} onClose={close} />
    </ListPage>
  );
}
