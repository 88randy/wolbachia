import type { TableQueryConfig } from "../data-table/table-types";

export const RISK_PAGE_SIZE = 25;

/** Risk categories of one week: server paging only, the week itself lives in the address bar. */
export const RISK_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: RISK_PAGE_SIZE,
  filters: [
    {
      kind: "text",
      key: "code",
      labelKey: "scheduling.risk.blockSearch",
      input: "search",
      maxLength: 64,
    },
  ],
  sortableIds: ["block__code", "category"],
  supportsVoided: false,
};

export const RISK_TABLE_SCOPE = { ignoredPrefixes: ["week"] };
