import type { TableQueryConfig } from "../data-table/table-types";

/** 200 is the most the API allows per page (`MAX_PAGE_SIZE`): the 12 parameters fit in one. */
export const PARAMETERS_PAGE_SIZE = 200;
export const VERSIONS_PAGE_SIZE = 100;

/**
 * Query string of the parameter list (W62). `GET /rule-parameters/` has no filters, no ordering
 * and no voided rows (a parameter is never voided; its versions are), so the table only pages.
 */
export const PARAMETERS_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PARAMETERS_PAGE_SIZE,
  sortableIds: [],
  supportsVoided: false,
  filters: [],
};

/**
 * Query string of a parameter's history. The API returns the whole history newest first and has
 * no `include_voided` parameter, so the "Include voided" toggle hides the voided versions of the
 * page in view (see `versions-table-data.ts`).
 */
export const VERSIONS_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: VERSIONS_PAGE_SIZE,
  sortableIds: [],
  supportsVoided: true,
  filters: [],
};
