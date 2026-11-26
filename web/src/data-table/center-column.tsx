import type { DataTableColumn } from "./table-types";
import { EntityName } from "../lookups/EntityName";
import { useShowCenter } from "../lookups/use-center-scope";

interface CenterColumnOptions {
  /** Column id; it is also the API ordering key when the list can sort by it. Default `center`. */
  id?: string;
}

/** The "Centro" column: the center NAME of each row (never an id). */
export function centerColumn<Row>(
  getCenterId: (row: Row) => string | null | undefined,
  opts: CenterColumnOptions = {},
): DataTableColumn<Row> {
  return {
    id: opts.id ?? "center",
    headerKey: "orgAdmin.center.filter",
    cell: (row) => <EntityName kind="center" id={getCenterId(row)} />,
  };
}

/**
 * Adds the center column only while `useShowCenter()` is true (several centers in scope and
 * none selected). Call it inside the hook that builds the columns; `after` is the id of the
 * column it goes behind (default: at the end).
 */
export function useCenterColumns<Row>(
  columns: readonly DataTableColumn<Row>[],
  getCenterId: (row: Row) => string | null | undefined,
  opts: CenterColumnOptions & { after?: string } = {},
): DataTableColumn<Row>[] {
  const show = useShowCenter();
  if (!show) return [...columns];
  const column = centerColumn(getCenterId, opts);
  const index = opts.after ? columns.findIndex((c) => c.id === opts.after) : -1;
  if (index < 0) return [...columns, column];
  return [...columns.slice(0, index + 1), column, ...columns.slice(index + 1)];
}
