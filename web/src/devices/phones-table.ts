import type { TableQueryConfig } from "../data-table/table-types";

export const PHONES_PAGE_SIZE = 25;

/** `?is_revoked=true|false` of `GET /api/v1/devices/`: the one filter besides `user`. */
export const IS_REVOKED_PARAM = "is_revoked";

/** W67 uses the public #224 search/order contract; current-user sessions are a meaningful facet. */
export const PHONES_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PHONES_PAGE_SIZE,
  defaultOrdering: "-created_at",
  sortableIds: ["label", "serial", "app_version", "last_seen_at", "created_at"],
  sortOptions: [
    { value: "label", labelKey: "phones.column.phone" },
    { value: "serial", labelKey: "refresh.filters.serial" },
    { value: "app_version", labelKey: "phones.column.version" },
    { value: "last_seen_at", labelKey: "phones.column.lastSeen" },
    { value: "created_at", labelKey: "refresh.filters.createdAt" },
  ],
  supportsVoided: false,
  filters: [
    { kind: "text", key: "search", labelKey: "refresh.filters.phoneSearch", maxLength: 200 },
    {
      kind: "select",
      key: IS_REVOKED_PARAM,
      labelKey: "phones.filter.status",
      options: [
        { value: "false", labelKey: "phones.status.active" },
        { value: "true", labelKey: "phones.status.revoked" },
      ],
    },
  ],
};

/** A current-user choice is meaningful without inventing a directory or a raw UUID picker. */
export function phonesTableFor(userId: string): TableQueryConfig {
  return {
    ...PHONES_TABLE,
    filters: [
      ...PHONES_TABLE.filters,
      {
        kind: "select",
        key: "user",
        labelKey: "refresh.filters.user",
        options: [{ value: userId, labelKey: "refresh.filters.myDevices" }],
      },
    ],
  };
}
