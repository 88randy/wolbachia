import type { TableQueryConfig, TableState } from "../../data-table/table-types";
import type { NoticeQuery } from "./notice-query";
import { PAGE_SIZE } from "./evaluation-query";
export const NOTICE_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PAGE_SIZE,
  supportsVoided: false,
  sortableIds: ["created_at", "id"],
  filters: [],
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
