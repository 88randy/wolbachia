import { unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";

export const MAX_PAGE = 200;

export interface ScheduleFilter {
  week: string;
  day?: string;
  courier?: string;
  pageSize: number;
}

/** Tasks of a week (or a day) with the load per courier. Server-side filters only. */
export function scheduleOptions(client: ApiClient, identity: SessionIdentity, f: ScheduleFilter) {
  return orgScopedQueryOptions(identity, {
    key: ["schedule", "list", f.week, f.day ?? "", f.courier ?? "", f.pageSize],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/schedule/", {
          params: {
            query: {
              week: f.week,
              page_size: f.pageSize,
              ...(f.day ? { day: f.day } : {}),
              ...(f.courier ? { courier: f.courier } : {}),
            },
          },
          signal,
        }),
      ),
  });
}

export function assignmentsOptions(client: ApiClient, identity: SessionIdentity) {
  return orgScopedQueryOptions(identity, {
    key: ["assignments", "list"],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/quadrant-assignments/", {
          params: { query: { page_size: MAX_PAGE, ordering: "code" } },
          signal,
        }),
      ),
  });
}

/** Display names of couriers. A missing or forbidden directory never blocks the screen. */
export function couriersOptions(client: ApiClient, identity: SessionIdentity) {
  return orgScopedQueryOptions(identity, {
    key: ["people", "operational"],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/users/operational/", {
          params: { query: { is_active: true, page_size: MAX_PAGE } },
          signal,
        }),
      ).results,
  });
}

export function quadrantsOptions(client: ApiClient, identity: SessionIdentity) {
  return orgScopedQueryOptions(identity, {
    key: ["quadrants", "directory"],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/quadrants/", {
          params: { query: { page_size: MAX_PAGE } },
          signal,
        }),
      ).results,
  });
}

export function risksOptions(
  client: ApiClient,
  identity: SessionIdentity,
  week: string,
  page: number,
  pageSize: number,
) {
  return orgScopedQueryOptions(identity, {
    key: ["risk", "list", week, page, pageSize],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/risk-categories/", {
          params: { query: { week, page, page_size: pageSize } },
          signal,
        }),
      ),
  });
}

export function interventionsOptions(
  client: ApiClient,
  identity: SessionIdentity,
  page: number,
  pageSize: number,
) {
  return orgScopedQueryOptions(identity, {
    key: ["interventions", "list", page, pageSize],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/third-party-interventions/", {
          params: { query: { page, page_size: pageSize } },
          signal,
        }),
      ),
  });
}

export function interventionTypesOptions(client: ApiClient, identity: SessionIdentity) {
  return orgScopedQueryOptions(identity, {
    key: ["catalogs", "intervention-type"],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/catalogs/{catalog_slug}/items/", {
          params: {
            path: { catalog_slug: "intervention-type" },
            query: { is_active: "true", page_size: MAX_PAGE },
          },
          signal,
        }),
      ).results,
  });
}

export function blocksDirectoryOptions(client: ApiClient, identity: SessionIdentity) {
  return orgScopedQueryOptions(identity, {
    key: ["blocks", "directory"],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/blocks/", { params: { query: { page_size: MAX_PAGE } }, signal }),
      ).results,
  });
}

export interface DayLoad {
  loads: { courier: string | null; load: number }[];
  /** Every point of the day, visited or not. */
  count: number;
  target: number;
  revision: number;
}

/**
 * The load of each courier on each day of a week. The server plans under a lock that answers 429
 * to concurrent readers, so the seven days are asked one after the other, never in parallel.
 */
export function weekLoadsOptions(
  client: ApiClient,
  identity: SessionIdentity,
  week: string,
  days: readonly string[],
) {
  return orgScopedQueryOptions(identity, {
    key: ["schedule", "week-loads", week],
    queryFn: async ({ signal }) => {
      const result: DayLoad[] = [];
      for (const day of days) {
        const page = unwrap(
          await client.GET("/api/v1/schedule/", {
            params: { query: { week, day, page_size: 1 } },
            signal,
          }),
        );
        result.push({
          loads: page.load,
          count: page.count,
          target: page.target,
          revision: page.revision,
        });
      }
      return result;
    },
  });
}
