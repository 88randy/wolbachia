import type { TableQueryConfig, TableState } from "../../data-table/table-types";
export const PAGE_SIZE = 25;
export const QUADRANT_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PAGE_SIZE,
  defaultOrdering: "code",
  sortableIds: ["code", "created_at"],
  supportsVoided: false,
  filters: [
    { key: "center", kind: "text", labelKey: "geography.field.center", maxLength: 36 },
    { key: "search", kind: "text", labelKey: "geography.field.search", maxLength: 100 },
  ],
};
export const RECORD_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PAGE_SIZE,
  sortableIds: [],
  supportsVoided: false,
  filters: [
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
