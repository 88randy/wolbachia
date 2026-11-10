import type { TableQueryConfig } from "../data-table/table-types";
export const RECEPTION_PAGE_SIZE = 25;
export const RECEPTION_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: RECEPTION_PAGE_SIZE,
  supportsVoided: false,
  defaultOrdering: "-created_at",
  sortableIds: ["created_at"],
  filters: [
    { key: "code", kind: "text", labelKey: "labReception.filters.code", maxLength: 50 },
    {
      key: "point",
      kind: "text",
      labelKey: "labReception.filters.point",
      maxLength: 36,
      input: "hidden",
    },
    { key: "week", kind: "text", labelKey: "labReception.filters.week", maxLength: 20 },
  ],
};
export const RECEPTION_URL_SCOPE = { ignoredPrefixes: ["view"] };
export type ReceptionView = "received" | "noPaddle" | "expected" | "discrepancies";
