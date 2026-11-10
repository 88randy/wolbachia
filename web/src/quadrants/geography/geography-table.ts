import { CENTER_FILTER } from "../../centers/center-filter";
import { CENTER_LOOKUP } from "../../lookups/lookup-sources";
import type { TableQueryConfig, TableState } from "../../data-table/table-types";
export const PAGE_SIZE = 25;
export const QUADRANT_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PAGE_SIZE,
  defaultOrdering: "code",
  sortableIds: ["code", "created_at"],
  supportsVoided: false,
  filters: [
    { ...CENTER_FILTER, input: "lookup", lookup: CENTER_LOOKUP },
    { key: "search", kind: "text", labelKey: "geography.field.search", maxLength: 100 },
  ],
};
export const RECORD_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PAGE_SIZE,
  sortableIds: [],
  supportsVoided: false,
  filters: [
    CENTER_FILTER,
    {
      key: "view",
      kind: "select",
      labelKey: "geography.field.view",
      options: [
        { value: "history", labelKey: "geography.history.title" },
        { value: "blocks", labelKey: "geography.blocks.title" },
        { value: "points", labelKey: "geography.points.title" },
      ],
    },
  ],
};
export function listParams(state: TableState) {
  const sort = state.sort;
  const ordering =
    state.isSortExplicit && sort ? `${sort.direction === "desc" ? "-" : ""}${sort.id}` : undefined;
  return { page: state.page, page_size: PAGE_SIZE, ...(ordering ? { ordering } : {}) };
}

/** W24 resource views expose only the inherited server code search and order. Histories do not. */
export const RESOURCE_TABLE: TableQueryConfig = {
  ...RECORD_TABLE,
  defaultOrdering: "code",
  sortableIds: ["code", "created_at"],
  filters: [
    ...RECORD_TABLE.filters,
    { key: "search", kind: "text", labelKey: "geography.field.search", maxLength: 100 },
  ],
};
/** Map/draft validation deliberately requests an unfiltered first page; list views pass URL state. */
export function resourceParams(pageOrState: number | TableState) {
  if (typeof pageOrState === "number") return { page: pageOrState, page_size: PAGE_SIZE };
  return {
    ...listParams(pageOrState),
    ...(pageOrState.filters["search"] ? { search: pageOrState.filters["search"] } : {}),
  };
}
