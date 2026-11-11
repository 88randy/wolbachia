import type { FilterDefinition, TableQueryConfig } from "../../data-table/table-types";
import { ALLOCATION_PAGE_SIZE } from "./allocation-query";

const date: FilterDefinition = {
  key: "date",
  labelKey: "allocation.filter.date",
  kind: "text",
  maxLength: 10,
  input: "hidden",
};
const createdFrom: FilterDefinition = {
  key: "created_at_from",
  labelKey: "allocation.filter.from",
  kind: "text",
  maxLength: 50,
  input: "date-from",
  dateFormat: "datetime",
};
const createdBefore: FilterDefinition = {
  key: "created_at_before",
  labelKey: "allocation.filter.before",
  kind: "text",
  maxLength: 50,
  input: "date-to",
  dateFormat: "datetime",
};
const base = {
  paging: "page",
  pageSize: ALLOCATION_PAGE_SIZE,
  defaultOrdering: "-created_at",
  sortableIds: ["created_at"],
  supportsVoided: false,
} as const;

export const RECONCILIATION_TABLE: TableQueryConfig = { ...base, filters: [date] };

export const WRITE_OFF_TABLE: TableQueryConfig = {
  ...base,
  filters: [
    createdFrom,
    createdBefore,
    {
      key: "kind",
      labelKey: "allocation.writeOff.fieldKind",
      kind: "select",
      presentation: "segmented",
      options: [
        { value: "lot", labelKey: "allocation.writeOff.kindLot" },
        { value: "bag", labelKey: "allocation.writeOff.kindBag" },
      ],
    },
  ],
};
