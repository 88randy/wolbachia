import type { TableQueryConfig } from "../data-table/table-types";
import type { FleetTab } from "./use-fleet-tabs";
import { FLEET_PAGE_SIZE } from "./fleet-table";
export type HistoryTab = Exclude<FleetTab, "summary">;
export const HISTORY_PREFIX: Record<HistoryTab, string> = {
  services: "service_",
  responsibility: "letter_",
  fuel: "fuel_",
  incidents: "incident_",
};
const base = { paging: "page", pageSize: FLEET_PAGE_SIZE } as const;
export const HISTORY_TABLES: Record<HistoryTab, TableQueryConfig> = {
  services: {
    ...base,
    supportsVoided: true,
    sortableIds: ["performed_at", "odometer_km", "created_at"],
    filters: [],
  },
  responsibility: {
    ...base,
    supportsVoided: true,
    sortableIds: ["issued_at", "created_at"],
    filters: [],
  },
  incidents: { ...base, supportsVoided: false, sortableIds: ["created_at"], filters: [] },
  fuel: {
    ...base,
    supportsVoided: false,
    sortableIds: ["event__device_time", "odometer_km", "efficiency_km_l", "created_at"],
    filters: [
      {
        kind: "select",
        key: "efficiency_status",
        labelKey: "fleet.fuel.comparison",
        options: [
          { value: "unavailable", labelKey: "fleet.gap.insufficient" },
          { value: "ok", labelKey: "fleet.efficiency.ok" },
          { value: "review", labelKey: "fleet.efficiency.review" },
        ],
      },
      {
        kind: "text",
        key: "courier",
        labelKey: "fleet.history.courier",
        maxLength: 36,
        input: "hidden",
      },
      {
        kind: "text",
        key: "date_from",
        labelKey: "fleet.fuel.from",
        maxLength: 64,
        input: "date-from",
        dateFormat: "date",
      },
      {
        kind: "text",
        key: "date_before",
        labelKey: "fleet.fuel.before",
        maxLength: 64,
        input: "date-to",
        dateFormat: "date",
      },
    ],
  },
};
