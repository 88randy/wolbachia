import type { ReactTable, RowData } from "@tanstack/react-table";
import { DataTableGrid } from "./DataTableGrid";
import { TableRefreshNotice } from "./TableRefreshNotice";
import { TableEmpty } from "./TableEmpty";
import { TableError } from "./TableError";
import { TableLoading } from "./TableLoading";
import type {
  DataTableColumn,
  RowSelectionConfig,
  TableController,
  TablePresentation,
  TableData,
  VoidInfo,
} from "./table-types";
import type { DataTableFeatures } from "./use-data-table";

interface DataTableContentProps<TRow extends RowData> extends TablePresentation<TRow> {
  caption: string;
  table: ReactTable<DataTableFeatures, TRow>;
  columns: readonly DataTableColumn<TRow>[];
  controller: TableController;
  data: TableData<TRow>;
  voidOf: ((row: TRow) => VoidInfo | null) | undefined;
  selection: RowSelectionConfig<TRow> | undefined;
}

/** A way back to the first page, only when the address is not on it (a page past the end fails). */
function firstPageOf(controller: TableController): (() => void) | undefined {
  const { page, cursor } = controller.state;
  if (controller.config.paging === "page" && page > 1) {
    return () => {
      controller.goToPage(1);
    };
  }
  if (controller.config.paging === "cursor" && cursor !== null) {
    return () => {
      controller.goToCursor(null);
    };
  }
  return undefined;
}

/** Chooses what the table area shows: the failure, the first load, "no results" or the rows. */
export function DataTableContent<TRow extends RowData>(props: DataTableContentProps<TRow>) {
  const { data, controller, ...grid } = props;
  if (data.error !== null && data.rows.length === 0) {
    return (
      <TableError error={data.error} onRetry={data.refetch} onFirstPage={firstPageOf(controller)} />
    );
  }
  if (data.isLoading) return <TableLoading columns={grid.columns.length} />;
  if (data.rows.length === 0) {
    return (
      <TableEmpty
        hasActiveFilters={controller.hasActiveFilters}
        onClearFilters={controller.clearFilters}
      />
    );
  }
  return (
    <>
      <TableRefreshNotice error={data.error} onRetry={data.refetch} />
      <DataTableGrid {...grid} controller={controller} />
    </>
  );
}
