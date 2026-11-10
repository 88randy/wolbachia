import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";
import { periodRange } from "./dashboard-filters";
import type { DashboardFilters } from "./dashboard-filters";

export type Dashboard = Schemas["Dashboard"];
export type DashboardKind = "operations" | "entomology" | "wolbachia-prevalence";

const PATHS = {
  operations: "/api/v1/analytics/operations/",
  entomology: "/api/v1/analytics/entomology/",
  "wolbachia-prevalence": "/api/v1/analytics/wolbachia-prevalence/",
} as const;

interface DashboardRequest {
  kind: DashboardKind;
  filters: DashboardFilters;
  today: string;
}

export function dashboardOptions(
  client: ApiClient,
  identity: SessionIdentity,
  { kind, filters, today }: DashboardRequest,
) {
  const { dateFrom, dateTo } = periodRange(filters.period, today);
  const query = {
    date_from: dateFrom,
    date_to: dateTo,
    granularity: filters.granularity,
    ...(filters.center === "" ? {} : { center: filters.center }),
    ...(filters.quadrant === "" ? {} : { quadrant: filters.quadrant }),
  };
  return orgScopedQueryOptions(identity, {
    key: ["analytics", kind, query],
    queryFn: async ({ signal }) =>
      unwrap(await client.GET(PATHS[kind], { params: { query }, signal })),
  });
}

/** Quadrants of the chosen center (all when none), for the filter picker. */
export function quadrantChoicesOptions(
  client: ApiClient,
  identity: SessionIdentity,
  center: string,
) {
  return orgScopedQueryOptions(identity, {
    key: ["analytics", "quadrant-choices", center],
    queryFn: async ({ signal }) => {
      const answer = unwrap(
        await client.GET("/api/v1/quadrants/", {
          params: {
            query: { page_size: 100, ordering: "code", ...(center === "" ? {} : { center }) },
          },
          signal,
        }),
      );
      return answer.results.map((quadrant) => ({ value: quadrant.id, label: quadrant.code }));
    },
  });
}
