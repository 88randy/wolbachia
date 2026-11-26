import type { TableQueryConfig, SelectFilter } from "../../data-table/table-types";
export const ADMIN_PAGE_SIZE = 50;
const VIEW_FILTER: SelectFilter = {
  key: "view",
  kind: "select",
  labelKey: "orgAdmin.roles.view",
  options: [
    { value: "roles", labelKey: "orgAdmin.roles.title" },
    { value: "memberships", labelKey: "orgAdmin.members.title" },
  ],
};
export const ROLES_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: ADMIN_PAGE_SIZE,
  sortableIds: ["slug"],
  defaultOrdering: "slug",
  supportsVoided: false,
  filters: [
    VIEW_FILTER,
    { key: "search", kind: "text", labelKey: "orgAdmin.roles.search", maxLength: 100 },
  ],
};
export const MEMBERS_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: ADMIN_PAGE_SIZE,
  sortableIds: ["created_at", "is_active"],
  defaultOrdering: "created_at",
  supportsVoided: false,
  filters: [
    VIEW_FILTER,
    {
      key: "profiles",
      kind: "text",
      labelKey: "users.members.filterProfile",
      input: "hidden",
      maxLength: 36,
    },
    {
      key: "is_active",
      kind: "select",
      labelKey: "orgAdmin.members.status",
      options: [
        { value: "true", labelKey: "orgAdmin.members.active" },
        { value: "false", labelKey: "orgAdmin.members.inactive" },
      ],
    },
  ],
};
