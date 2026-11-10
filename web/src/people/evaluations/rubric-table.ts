import type { TableQueryConfig } from "../../data-table/table-types";
import { PAGE_SIZE } from "./evaluation-query";
export const RUBRIC_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PAGE_SIZE,
  filters: [],
  sortableIds: [],
  supportsVoided: false,
};
export const RUBRIC_SCOPE = {
  prefix: "rubric_",
  ignoredPrefixes: [
    "item",
    "attempt_",
    "subject",
    "center",
    "quadrant",
    "page",
    "ordering",
    "include_voided",
  ],
};
