import { pageTableData } from "../../data-table/table-data";
import type { DataTableColumn, TableController } from "../../data-table/table-types";
import { PAGE_SIZE } from "./geography-table";
/** Preserve shared table paging/error/empty semantics across geography record lists. */
export function geographyPageTable<Row extends { id: string }>(
  query: Parameters<typeof pageTableData<Row>>[0],
  controller: TableController,
  columns: readonly DataTableColumn<Row>[],
) {
  return {
    columns,
    controller,
    data: pageTableData(query, controller.state.page, PAGE_SIZE),
    getRowId: (row: Row) => row.id,
  };
}
