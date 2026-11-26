import { withRowMenu } from "./row-menu";
import type { RowData } from "@tanstack/react-table";
import { DataTableContent } from "./DataTableContent";
import { SelectedRowsBar } from "./SelectedRowsBar";
import { TableToolbar } from "./TableToolbar";
import { TableFooter } from "./TableFooter";
import styles from "./data-table.module.css";
import type {
  DataTableColumn,
  RowSelectionConfig,
  TableController,
  TableData,
  TablePresentation,
  VoidInfo,
} from "./table-types";
import { useDataTable } from "./use-data-table";
import { useSortText } from "./use-sort-text";
export interface DataTableProps<Row extends RowData> extends TablePresentation<Row> {
  caption: string;
  columns: readonly DataTableColumn<Row>[];
  getRowId: (row: Row) => string;
  controller: TableController;
  data: TableData<Row>;
  voidOf?: (row: Row) => VoidInfo | null;
  selection?: RowSelectionConfig<Row>;
}
/** Server-owned rows, with optional grouping/details and no client-side reordering. */
export function DataTable<Row extends RowData>(props: DataTableProps<Row>) {
  const { caption, columns, getRowId, controller, data, voidOf, selection, ...rest } = props;
  const presentation = withRowMenu(rest);
  const isSelectable = selection && (selection.isSelectable ?? (() => true));
  const table = useDataTable({ columns, rows: data.rows, getRowId, isSelectable });
  const sortText = useSortText(controller.state.sort, columns);
  return (
    <div
      className={styles.wrap}
      aria-busy={data.isFetching}
      data-embedded={presentation.embedded || undefined}
      data-density={presentation.density ?? "comfortable"}
    >
      <TableToolbar
        density={presentation.density}
        onDensityChange={presentation.onDensityChange}
        refreshing={data.isFetching && !data.isLoading}
      />
      <SelectedRowsBar table={table} selection={selection} />
      <DataTableContent
        {...{ caption, table, columns, controller, data, voidOf, selection }}
        {...presentation}
      />
      <TableFooter data={data} controller={controller} sortText={sortText} />
    </div>
  );
}
