import type { ReactNode } from "react";
import { flexRender } from "@tanstack/react-table";
import type { Row, RowData } from "@tanstack/react-table";
import { DataTableCell } from "./DataTableCell";
import { VoidedDetail } from "./VoidedDetail";
import type { DataTableColumn, VoidInfo } from "./table-types";
import type { DataTableFeatures } from "./use-data-table";

interface RowCellsProps<TRow extends RowData> {
  row: Row<DataTableFeatures, TRow>;
  columns: readonly DataTableColumn<TRow>[];
  voidInfo: VoidInfo | null;
  leading?: ReactNode;
}

/** The data cells of a row. A voided row strikes them through and details it in the first one. */
export function RowCells<TRow extends RowData>({
  row,
  columns,
  voidInfo,
  leading,
}: RowCellsProps<TRow>) {
  return row.getAllCells().map((cell, index) => {
    const definition = columns.find((column) => column.id === cell.column.id);
    return (
      <DataTableCell
        key={cell.id}
        before={index === 0 ? leading : undefined}
        align={definition?.align ?? "start"}
        link={definition?.link?.(row.original)}
        isStruck={voidInfo !== null}
        after={index === 0 && voidInfo !== null ? <VoidedDetail info={voidInfo} /> : null}
      >
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </DataTableCell>
    );
  });
}
