import { CENTER_LOOKUP, QUADRANT_LOOKUP } from "../../lookups/lookup-sources";
import type { TableQueryConfig, TableState } from "../../data-table/table-types";
import type { NoticeQuery } from "./notice-query";
import { PAGE_SIZE } from "./evaluation-query";
export const NOTICE_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PAGE_SIZE,
  supportsVoided: false,
  sortableIds: ["created_at", "id"],
  filters: [
    {
      kind: "text",
      key: "center",
      labelKey: "evaluations.field.center",
      maxLength: 36,
      input: "lookup",
      lookup: CENTER_LOOKUP,
    },
    {
      kind: "text",
      key: "quadrant",
      labelKey: "evaluations.field.quadrant",
      maxLength: 36,
      input: "lookup",
      lookup: QUADRANT_LOOKUP,
    },
  ],
};
export const NOTICE_SCOPE = { prefix: "notice_" };
export function noticeQuery(state: TableState, activeCenter?: string): NoticeQuery {
  return {
    page: state.page,
    page_size: PAGE_SIZE,
    center: state.filters["center"] ?? (activeCenter || undefined),
    quadrant: state.filters["quadrant"],
    ordering: state.sort
      ? `${state.sort.direction === "desc" ? "-" : ""}${state.sort.id}`
      : undefined,
  };
}
