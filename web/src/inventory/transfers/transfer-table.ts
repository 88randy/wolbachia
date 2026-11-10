import type { TableQueryConfig } from "../../data-table/table-types";
import { TRANSFER_PAGE_SIZE } from "./transfer-query";
export const TRANSFER_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: TRANSFER_PAGE_SIZE,
  defaultOrdering: "-created_at",
  sortableIds: ["code", "created_at"],
  supportsVoided: false,
  sortOptions: [
    { value: "code", labelKey: "transfers.field.code" },
    { value: "created_at", labelKey: "inventory.field.createdAt" },
  ],
  filters: [
    { key: "search", labelKey: "inventory.field.search", kind: "text", maxLength: 200 },
    {
      key: "state",
      labelKey: "inventory.field.status",
      kind: "select",
      presentation: "segmented",
      options: [
        { value: "prepared", labelKey: "transfers.state.prepared" },
        { value: "dispatched", labelKey: "transfers.state.dispatched" },
        { value: "discrepancy", labelKey: "transfers.state.discrepancy" },
        { value: "received", labelKey: "transfers.state.received" },
        { value: "resolved", labelKey: "transfers.state.resolved" },
      ],
    },
    {
      key: "created_at_from",
      labelKey: "transfers.field.from",
      kind: "text",
      maxLength: 50,
      input: "date-from",
      dateFormat: "datetime",
    },
    {
      key: "created_at_before",
      labelKey: "transfers.field.before",
      kind: "text",
      maxLength: 50,
      input: "date-to",
      dateFormat: "datetime",
    },
  ],
};
