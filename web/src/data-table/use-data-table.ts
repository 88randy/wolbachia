import {
  createColumnHelper,
  rowSelectionFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { RowData } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "./table-types";
import { useRowSelection } from "./use-row-selection";

// Table v9 recomputes its row models when these change identity: keep them at module level.
const features = tableFeatures({ rowSelectionFeature });
export type DataTableFeatures = typeof features;

interface UseDataTableOptions<Row extends RowData> {
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  getRowId: (row: Row) => string;
  /** `undefined`: the table has no selection. */
  isSelectable: ((row: Row) => boolean) | undefined;
}

function toTableColumns<Row extends RowData>(
  columns: readonly DataTableColumn<Row>[],
  t: TFunction,
) {
  const helper = createColumnHelper<DataTableFeatures, Row>();
  return helper.columns(
    columns.map((column) =>
      helper.display({
        id: column.id,
        header: t(column.headerKey),
        cell: ({ row }) => column.cell(row.original),
      }),
    ),
  );
}

/**
 * TanStack Table (headless, ADR 0001 decision 21) as the row, column and selection model of the
 * `DataTable`. Sorting, filtering and paging are NOT done here: they are server-side, so the
 * rows it gets are already the page to show.
 */
export function useDataTable<Row extends RowData>(options: UseDataTableOptions<Row>) {
  const { columns, rows, getRowId, isSelectable } = options;
  const { t } = useTranslation();
  const [rowSelection, setRowSelection] = useRowSelection(rows);
  const tableColumns = useMemo(() => toTableColumns(columns, t), [columns, t]);
  return useTable({
    features,
    columns: tableColumns,
    data: rows,
    getRowId,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: isSelectable === undefined ? false : (row) => isSelectable(row.original),
  });
}
