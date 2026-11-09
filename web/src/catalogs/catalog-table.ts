import type { TableQueryConfig } from "../data-table/table-types";
export const CATALOG_PAGE_SIZE = 25;
export const CATALOG_NAV_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: CATALOG_PAGE_SIZE,
  defaultOrdering: "slug",
  supportsVoided: false,
  sortableIds: ["slug", "label_es", "label_en"],
  sortOptions: [
    { value: "slug", labelKey: "refresh.filters.catalogSlug" },
    { value: "label_es", labelKey: "refresh.filters.labelEs" },
    { value: "label_en", labelKey: "refresh.filters.labelEn" },
  ],
  filters: [
    { key: "search", kind: "text", labelKey: "refresh.filters.catalogsSearch", maxLength: 200 },
  ],
};
export const CATALOG_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: CATALOG_PAGE_SIZE,
  defaultOrdering: "sort",
  supportsVoided: false,
  sortableIds: ["code", "label_es", "label_en", "sort", "created_at", "usage_count"],
  sortOptions: [
    { value: "code", labelKey: "catalogs.table.code" },
    { value: "label_es", labelKey: "refresh.filters.labelEs" },
    { value: "label_en", labelKey: "refresh.filters.labelEn" },
    { value: "sort", labelKey: "refresh.filters.position" },
    { value: "created_at", labelKey: "catalogs.table.created" },
    { value: "usage_count", labelKey: "catalogs.table.usage" },
  ],
  filters: [
    { key: "search", kind: "text", labelKey: "refresh.filters.catalogSearch", maxLength: 200 },
    {
      key: "is_active",
      kind: "select",
      presentation: "segmented",
      labelKey: "catalogs.table.status",
      options: [
        { value: "true", labelKey: "catalogs.status.active" },
        { value: "false", labelKey: "catalogs.status.inactive" },
      ],
    },
  ],
};
