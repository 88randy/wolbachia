import type { TableQueryConfig } from "../data-table/table-types";
export const SHIFT_PAGE_SIZE = 25;
export const SHIFTS_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: SHIFT_PAGE_SIZE,
  supportsVoided: false,
  sortableIds: [],
  filters: [
    {
      kind: "select",
      key: "status",
      labelKey: "shift.field.lifecycle",
      options: [
        { value: "closed", labelKey: "shift.status.closed" },
        { value: "open", labelKey: "shift.status.open" },
      ],
    },
  ],
};
