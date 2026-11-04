import type { ReactTable, RowData } from "@tanstack/react-table";
import { SelectionBar } from "./SelectionBar";
import type { RowSelectionConfig } from "./table-types";
import type { DataTableFeatures } from "./use-data-table";

interface SelectedRowsBarProps<TRow extends RowData> {
  table: ReactTable<DataTableFeatures, TRow>;
  selection: RowSelectionConfig<TRow> | undefined;
}

/** The bar of the rows selected on this page, with the screen's actions; nothing when none. */
export function SelectedRowsBar<TRow extends RowData>({
  table,
  selection,
}: SelectedRowsBarProps<TRow>) {
  const selected = table.getSelectedRowModel().rows.map((row) => row.original);
  if (selection === undefined || selected.length === 0) return null;
  return (
    <SelectionBar
      count={selected.length}
      actions={selection.renderActions?.(selected)}
      onClear={() => {
        table.resetRowSelection(true);
      }}
    />
  );
}
