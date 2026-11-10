import type { TableQueryConfig, TableState } from "../../data-table/table-types";
import type { EvaluationQuery } from "./evaluation-query";
import { PAGE_SIZE } from "./evaluation-query";
export const EVALUATION_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PAGE_SIZE,
  supportsVoided: true,
  sortableIds: ["created_at", "id"],
  defaultOrdering: "-created_at",
  filters: [],
};
export const EVALUATION_TABLE_SCOPE = {
  ignoredPrefixes: ["item", "rubric_", "attempt_", "notice_"],
};
export function evaluationQuery(state: TableState, activeCenter?: string): EvaluationQuery {
  return {
    page: state.page,
    page_size: PAGE_SIZE,
    include_voided: state.includeVoided ? "true" : "false",
    subject: state.filters["subject"],
    center: state.filters["center"] ?? (activeCenter || undefined),
    quadrant: state.filters["quadrant"],
    ordering: state.sort
      ? `${state.sort.direction === "desc" ? "-" : ""}${state.sort.id}`
      : undefined,
  };
}
