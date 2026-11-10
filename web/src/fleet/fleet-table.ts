import { CENTER_FILTER } from "../centers/center-filter";
import type { TableQueryConfig } from "../data-table/table-types";
export const FLEET_PAGE_SIZE = 25;
export const FLEET_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: FLEET_PAGE_SIZE,
  sortableIds: ["code", "plate", "created_at", "center"],
  defaultOrdering: "code",
  supportsVoided: true,
  filters: [
    CENTER_FILTER,
    { kind: "text", key: "code", labelKey: "refresh.table.exactCode", maxLength: 64 },
    {
      kind: "select",
      key: "is_blocked",
      labelKey: "fleet.column.status",
      presentation: "segmented",
      options: [
        { value: "false", labelKey: "fleet.status.available" },
        { value: "true", labelKey: "fleet.status.blocked" },
      ],
    },
  ],
};
