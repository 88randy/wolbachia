import type { RowData } from "@tanstack/react-table";
import { OverflowMenu } from "../components/templates/OverflowMenu";
import type { TablePresentation } from "./table-types";

/** `rowMenu` becomes a "⋯" menu at the end of the actions column (after any `rowActions`). */
export function withRowMenu<Row extends RowData>(
  presentation: TablePresentation<Row>,
): TablePresentation<Row> {
  const { rowMenu, rowActions } = presentation;
  if (!rowMenu) return presentation;
  return {
    ...presentation,
    rowActions: (row) => (
      <>
        {rowActions?.(row)}
        <OverflowMenu actions={rowMenu(row)} size="sm" />
      </>
    ),
  };
}
