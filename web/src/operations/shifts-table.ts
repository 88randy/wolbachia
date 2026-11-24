import type { TableQueryConfig } from "../data-table/table-types";
import { PERSON_LOOKUP } from "../lookups/lookup-sources";
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
    // Day history of a courier (W29 then shows each shift's track).
    {
      kind: "text",
      key: "courier",
      labelKey: "shift.filter.courier",
      maxLength: 36,
      input: "lookup",
      lookup: PERSON_LOOKUP,
    },
    {
      kind: "text",
      key: "date_from",
      labelKey: "shift.filter.dateFrom",
      maxLength: 64,
      input: "date-from",
      dateFormat: "date",
    },
    {
      kind: "text",
      key: "date_to",
      labelKey: "shift.filter.dateTo",
      maxLength: 64,
      input: "date-to",
      dateFormat: "date",
    },
  ],
};
