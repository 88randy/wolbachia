import type {
  TableQueryConfig,
  FilterDefinition,
  FilterOption,
} from "../../data-table/table-types";
import { PAGE_SIZE } from "./geography-table";
export const HISTORY_PREFIX = "history_";
const COMMON_SORTS: FilterOption[] = [
  { value: "effective_from", labelKey: "geography.field.effective" },
  { value: "created_at", labelKey: "refresh.filters.createdAt" },
  { value: "created_by", labelKey: "geography.field.author" },
];
const DATES: FilterDefinition[] = [
  {
    key: "effective_from_from",
    kind: "text",
    labelKey: "refresh.filters.effectiveFrom",
    maxLength: 40,
  },
  {
    key: "effective_from_before",
    kind: "text",
    labelKey: "refresh.filters.effectiveBefore",
    maxLength: 40,
  },
];
const POINT_STATUS: FilterDefinition = {
  key: "is_retired",
  kind: "select",
  labelKey: "geography.field.status",
  options: [
    { value: "false", labelKey: "geography.status.active" },
    { value: "true", labelKey: "geography.status.retired" },
  ],
};
function numberFilter(version: string): FilterDefinition {
  return {
    key: version,
    kind: "text",
    format: "positive-integer",
    labelKey: "geography.field.revision",
    maxLength: 16,
  };
}
function authorFilter(userId: string): FilterDefinition {
  return {
    key: "created_by",
    kind: "select",
    labelKey: "geography.field.author",
    options: [{ value: userId, labelKey: "refresh.filters.myChanges" }],
  };
}
/** Histories have their own validated contract; parent identity-list filters never reach them. */
export function historyTable(isPoint: boolean, userId: string): TableQueryConfig {
  const version = isPoint ? "version" : "revision";
  const sortOptions: FilterOption[] = [
    { value: version, labelKey: "geography.field.revision" },
    ...COMMON_SORTS,
    ...(isPoint ? [{ value: "is_retired", labelKey: "geography.field.status" } as const] : []),
  ];
  return {
    paging: "page",
    pageSize: PAGE_SIZE,
    defaultOrdering: `-${version}`,
    sortableIds: sortOptions.map((option) => option.value),
    sortOptions,
    supportsVoided: false,
    filters: [
      numberFilter(version),
      authorFilter(userId),
      ...DATES,
      ...(isPoint ? [POINT_STATUS] : []),
    ],
  };
}
