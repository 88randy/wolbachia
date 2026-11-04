import type { TableQueryConfig } from "../data-table/table-types";

export const PHONES_PAGE_SIZE = 25;

/** `?is_revoked=true|false` of `GET /api/v1/devices/`: the one filter besides `user`. */
export const IS_REVOKED_PARAM = "is_revoked";

/**
 * Query string of the phones list (W67). What the endpoint supports decides what is here:
 * page-number paging and the `is_revoked` filter. It has no `ordering` and no `include_voided`
 * (a phone is revoked, never voided), so no column sorts and there is no voided toggle. The
 * `user` filter needs a user to pick; there is no users endpoint for the web yet.
 */
export const PHONES_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PHONES_PAGE_SIZE,
  sortableIds: [],
  supportsVoided: false,
  filters: [
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
