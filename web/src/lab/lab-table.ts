import type { TableQueryConfig } from "../data-table/table-types";
import { PAGE_SIZE } from "./lab-query";
const FILTERS = [{ kind: "text", key: "code", labelKey: "lab.queue.scan", maxLength: 50 }] as const;
export const QUEUE_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PAGE_SIZE,
  defaultOrdering: "created_at",
  sortableIds: ["code", "created_at"],
  supportsVoided: false,
  filters: FILTERS,
};
export const HISTORY_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PAGE_SIZE,
  defaultOrdering: "-created_at",
  sortableIds: ["created_at"],
  supportsVoided: true,
  filters: FILTERS,
};
