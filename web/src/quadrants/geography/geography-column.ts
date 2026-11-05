import type { ReactNode } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import type { DataTableColumn } from "../../data-table/table-types";
/** Shared column shape, keeping the record-specific display/links with its screen. */
export function geographyColumn<Row>(
  id: string,
  headerKey: MessageKey,
  cell: (row: Row) => ReactNode,
): DataTableColumn<Row> {
  return { id, headerKey, cell };
}
