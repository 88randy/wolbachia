import type { TableQueryConfig, TableState } from "../../data-table/table-types";
import { REVIEW_PAGE_SIZE } from "./review-query";
import type { ReviewQuery } from "./review-query";

export const REVIEW_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: REVIEW_PAGE_SIZE,
  supportsVoided: false,
  sortableIds: ["created_at", "event_type", "kind", "code"],
  defaultOrdering: "-created_at",
  limitationsKey: "reviews.workspace.listHint",
  filters: [
    {
      kind: "select",
      key: "kind",
      labelKey: "reviews.workspace.ingest",
      options: [
        { value: "in_review", labelKey: "reviews.workspace.inReview" },
        { value: "rejected", labelKey: "reviews.workspace.rejected" },
      ],
    },
    { kind: "text", key: "search", labelKey: "reviews.workspace.search", maxLength: 200 },
  ],
};

export function reviewTableQuery(state: TableState): ReviewQuery {
  return {
    page: state.page,
    page_size: REVIEW_PAGE_SIZE,
    kind: state.filters["kind"] as ReviewQuery["kind"],
    code: state.filters["code"],
    search: state.filters["search"],
    ordering: state.sort
      ? `${state.sort.direction === "desc" ? "-" : ""}${state.sort.id}`
      : undefined,
  };
}
