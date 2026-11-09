import type { TableQueryConfig } from "../data-table/table-types";

/** 200 is the most the API allows per page (`MAX_PAGE_SIZE`): the 12 parameters fit in one. */
export const PARAMETERS_PAGE_SIZE = 200;
export const VERSIONS_PAGE_SIZE = 100;

/**
 * W62 exposes only the public search/facet/order allowlists from the generated #224 contract.
 */
export const PARAMETERS_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PARAMETERS_PAGE_SIZE,
  defaultOrdering: "key",
  sortableIds: ["key", "unit", "value_type", "effective_from"],
  sortOptions: [
    { value: "key", labelKey: "rules.column.key" },
    { value: "unit", labelKey: "rules.column.unit" },
    { value: "value_type", labelKey: "refresh.filters.valueType" },
    { value: "effective_from", labelKey: "rules.column.since" },
  ],
  supportsVoided: false,
  filters: [
    { key: "search", kind: "text", labelKey: "refresh.filters.ruleSearch", maxLength: 200 },
    {
      key: "value_type",
      kind: "select",
      labelKey: "refresh.filters.valueType",
      options: [
        { value: "integer", labelKey: "refresh.filters.integer" },
        { value: "decimal", labelKey: "refresh.filters.decimal" },
      ],
    },
    {
      key: "unit",
      kind: "select",
      labelKey: "rules.column.unit",
      options: [
        { value: "m", labelKey: "rules.unit.meters" },
        { value: "km_h", labelKey: "rules.unit.kmPerHour" },
        { value: "s", labelKey: "rules.unit.seconds" },
        { value: "min", labelKey: "rules.unit.minutes" },
        { value: "day", labelKey: "rules.unit.days" },
        { value: "week", labelKey: "rules.unit.weeks" },
        { value: "count", labelKey: "rules.unit.count" },
        { value: "km_l", labelKey: "rules.unit.kmPerLiter" },
      ],
    },
  ],
};

/**
 * Query string of a parameter's history: newest first, paged by the server, which leaves voided
 * versions out unless `include_voided=true` (the "Include voided" toggle).
 */
export const VERSIONS_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: VERSIONS_PAGE_SIZE,
  defaultOrdering: "-effective_from",
  sortableIds: ["effective_from", "created_at", "value"],
  sortOptions: [
    { value: "effective_from", labelKey: "rules.history.effective" },
    { value: "created_at", labelKey: "rules.history.created" },
    { value: "value", labelKey: "rules.history.value" },
  ],
  supportsVoided: true,
  filters: [
    { key: "search", kind: "text", labelKey: "refresh.filters.reasonSearch", maxLength: 200 },
    {
      key: "status",
      kind: "select",
      labelKey: "rules.history.status",
      options: [
        { value: "scheduled", labelKey: "rules.status.scheduled" },
        { value: "in_force", labelKey: "rules.status.inForce" },
        { value: "superseded", labelKey: "rules.status.superseded" },
        { value: "voided", labelKey: "rules.status.voided" },
      ],
    },
  ],
};
