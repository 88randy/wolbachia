import type { ReactTable, RowData } from "@tanstack/react-table";
import utilities from "../styles/utilities.module.css";
import { DataTableHead } from "./DataTableHead";
import { DataTableRow } from "./DataTableRow";
import styles from "./data-table.module.css";
import type { DataTableColumn, RowSelectionConfig, TableController, VoidInfo } from "./table-types";
import type { DataTableFeatures } from "./use-data-table";
import { useSelectAll } from "./use-select-all";

interface DataTableGridProps<TRow extends RowData> {
  caption: string;
  table: ReactTable<DataTableFeatures, TRow>;
  columns: readonly DataTableColumn<TRow>[];
  controller: TableController;
  voidOf: ((row: TRow) => VoidInfo | null) | undefined;
  selection: RowSelectionConfig<TRow> | undefined;
}

/** The semantic `<table>`: caption, column headers (with `aria-sort`) and one row per record. */
export function DataTableGrid<TRow extends RowData>(props: DataTableGridProps<TRow>) {
  const { caption, table, columns, controller, voidOf, selection } = props;
  const selectAll = useSelectAll(table);
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <caption className={utilities.srOnly}>{caption}</caption>
        <DataTableHead
          columns={columns}
          controller={controller}
          selectAll={selection === undefined ? undefined : selectAll}
        />
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <DataTableRow
              key={row.id}
              row={row}
              columns={columns}
              voidInfo={voidOf?.(row.original) ?? null}
              selection={selection}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
