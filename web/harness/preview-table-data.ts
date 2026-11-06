import type { TableQueryConfig } from "../src/data-table/table-types";
export const PREVIEW_NOW = Date.parse("2026-11-05T15:00:00Z");
export const PREVIEW_CONFIG: TableQueryConfig = {
  paging: "page",
  pageSize: 10,
  supportsVoided: true,
  sortableIds: [],
  filters: [],
};
export const PREVIEW_ROWS = [
  { id: "OV-1284", center: "N-01", date: "2026-11-05T14:48:00Z", status: "success", count: 8 },
  { id: "OV-1283", center: "N-02", date: "2026-11-05T14:30:00Z", status: "warning", count: 6 },
  { id: "OV-1282", center: "N-01", date: "2026-11-05T13:45:00Z", status: "critical", count: 4 },
  { id: "OV-1281", center: "N-03", date: "2026-11-04T21:20:00Z", status: "info", count: 9 },
  { id: "OV-1280", center: "N-02", date: "2026-11-04T20:15:00Z", status: "neutral", count: 5 },
  {
    id: "OV-1279",
    center: "N-01",
    date: "2026-11-03T18:00:00Z",
    status: "neutral",
    count: 2,
    isVoided: true,
  },
] as const;
export type PreviewRecord = (typeof PREVIEW_ROWS)[number];
