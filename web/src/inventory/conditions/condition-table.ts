import type { TableQueryConfig } from "../../data-table/table-types";
export const CONDITION_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: 25,
  defaultOrdering: "-device_time",
  sortableIds: ["device_time"],
  supportsVoided: false,
  sortOptions: [{ value: "device_time", labelKey: "conditions.field.deviceTime" }],
  filters: [
    { key: "local_date", labelKey: "conditions.field.localDate", kind: "text", maxLength: 10 },
    {
      key: "evaluation",
      labelKey: "conditions.field.evaluation",
      kind: "select",
      options: [
        { value: "normal", labelKey: "conditions.evaluation.normal" },
        { value: "breach", labelKey: "conditions.evaluation.breach" },
        { value: "unassessed", labelKey: "conditions.evaluation.unassessed" },
      ],
    },
  ],
};
