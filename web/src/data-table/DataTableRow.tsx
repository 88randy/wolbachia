import type { Row, RowData } from "@tanstack/react-table";
import { classNames } from "../styles/class-names";
import { RowCells } from "./RowCells";
import { RowSelectCell } from "./RowSelectCell";
import styles from "./data-table.module.css";
import type { DataTableColumn, RowSelectionConfig, VoidInfo } from "./table-types";
import type { DataTableFeatures } from "./use-data-table";

interface DataTableRowProps<TRow extends RowData> {
  row: Row<DataTableFeatures, TRow>;
  columns: readonly DataTableColumn<TRow>[];
  voidInfo: VoidInfo | null;
  selection: RowSelectionConfig<TRow> | undefined;
}

export function DataTableRow<TRow extends RowData>(props: DataTableRowProps<TRow>) {
  const { row, columns, voidInfo, selection } = props;
  const className = classNames(row.getIsSelected() && styles.selected, voidInfo && styles.voided);
  return (
    <tr className={className}>
      {selection !== undefined && (
        <RowSelectCell row={row} label={selection.rowLabel(row.original)} />
      )}
      <RowCells row={row} columns={columns} voidInfo={voidInfo} />
    </tr>
  );
}
