import type { RowData } from "@tanstack/react-table";
import { DataTableContent } from "./DataTableContent";
import { Pager } from "./Pager";
import { SelectedRowsBar } from "./SelectedRowsBar";
import { TableStatus } from "./TableStatus";
import styles from "./data-table.module.css";
import type {
  DataTableColumn,
  RowSelectionConfig,
  TableController,
  TableData,
  VoidInfo,
} from "./table-types";
import { useDataTable } from "./use-data-table";
import { useSortText } from "./use-sort-text";

export interface DataTableProps<Row extends RowData> {
  /** Accessible name of the table (read by screen readers, not drawn). */
  caption: string;
  columns: readonly DataTableColumn<Row>[];
  getRowId: (row: Row) => string;
  /** The address-bar state and its actions (`useTableUrlState`). */
  controller: TableController;
  data: TableData<Row>;
  /** Marks a row as voided: it is struck through and shows badge, reason and author. */
  voidOf?: (row: Row) => VoidInfo | null;
  selection?: RowSelectionConfig<Row>;
}

/**
 * The shared list table (#29). It only draws what the server returned for the address in the
 * URL: sorting, filtering and paging are requests, never work done on a full dataset in the
 * browser. Semantic `<table>`, native buttons and checkboxes, live regions for the result count
 * and the sort state, and no meaning carried by color alone.
 */
export function DataTable<Row extends RowData>(props: DataTableProps<Row>) {
  const { caption, columns, getRowId, controller, data, voidOf, selection } = props;
  const isSelectable = selection && (selection.isSelectable ?? (() => true));
  const table = useDataTable({ columns, rows: data.rows, getRowId, isSelectable });
  const sortText = useSortText(controller.state.sort, columns);
  return (
    <div className={styles.wrap} aria-busy={data.isFetching}>
      <SelectedRowsBar table={table} selection={selection} />
      <DataTableContent {...{ caption, table, columns, controller, data, voidOf, selection }} />
      <div className={styles.footer}>
        <TableStatus
          paging={data.paging}
          rowCount={data.rows.length}
          isFetching={data.isFetching}
          sortText={sortText}
        />
        {data.paging !== undefined && <Pager paging={data.paging} controller={controller} />}
      </div>
    </div>
  );
}
