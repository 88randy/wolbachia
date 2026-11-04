import { useTranslation } from "react-i18next";
import type { DataTableColumn, SortState } from "./table-types";

/**
 * "Sorted by Version, ascending" for the live region, or `null` when the table is not sorted by
 * a column it shows. The direction and the column are read aloud as words, not arrows.
 */
export function useSortText(
  sort: SortState | null,
  columns: readonly DataTableColumn<never>[],
): string | null {
  const { t } = useTranslation();
  const column = columns.find((candidate) => candidate.id === sort?.id);
  if (sort === null || column === undefined) return null;
  const key = sort.direction === "asc" ? "table.sort.ascending" : "table.sort.descending";
  return t(key, { column: t(column.headerKey) });
}
