import type { ReactTable, RowData } from "@tanstack/react-table";
import { DataTableRow } from "./DataTableRow";
import { RowGroup } from "./RowGroup";
import type { DataTableFeatures } from "./use-data-table";
import type {
  DataTableColumn,
  RowSelectionConfig,
  TablePresentation,
  VoidInfo,
} from "./table-types";
interface BodyProps<TRow extends RowData> extends TablePresentation<TRow> {
  table: ReactTable<DataTableFeatures, TRow>;
  columns: readonly DataTableColumn<TRow>[];
  voidOf: ((row: TRow) => VoidInfo | null) | undefined;
  selection: RowSelectionConfig<TRow> | undefined;
}
export function DataTableBody<TRow extends RowData>(props: BodyProps<TRow>) {
  const { table, columns, voidOf, selection, groupOf, renderDetail, rowActions } = props;
  const rows = table.getRowModel().rows;
  const columnCount =
    columns.length + Number(selection !== undefined) + Number(rowActions !== undefined);
  return (
    <tbody>
      {rows.map((row, index) => {
        const group = groupOf?.(row.original);
        const previous = rows[index - 1];
        const hasGroup =
          group && (previous === undefined || groupOf?.(previous.original).id !== group.id);
        return (
          <RowGroup key={row.id} label={hasGroup ? group.label : undefined} columns={columnCount}>
            <DataTableRow
              row={row}
              columns={columns}
              voidInfo={voidOf?.(row.original) ?? null}
              selection={selection}
              renderDetail={renderDetail}
              rowActions={rowActions}
            />
          </RowGroup>
        );
      })}
    </tbody>
  );
}
