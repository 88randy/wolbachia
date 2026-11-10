import type { TableQueryConfig } from "../data-table/table-types";

export const USERS_PAGE_SIZE = 25;
export const IS_ACTIVE_PARAM = "is_active";

/** W48: search by name/email/phone and an explicit, visible "Active" default filter. */
export const USERS_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: USERS_PAGE_SIZE,
  defaultOrdering: "display_name",
  sortableIds: ["display_name"],
  sortOptions: [{ value: "display_name", labelKey: "users.column.name" }],
  supportsVoided: false,
  filters: [
    { kind: "text", key: "search", labelKey: "users.filter.search", maxLength: 200 },
    {
      kind: "select",
      key: IS_ACTIVE_PARAM,
      labelKey: "users.filter.status",
      options: [
        { value: "true", labelKey: "users.status.active" },
        { value: "false", labelKey: "users.status.inactive" },
      ],
    },
  ],
};
