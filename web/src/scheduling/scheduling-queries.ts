import { ApiError, unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";
import type { TableState } from "../data-table/table-types";

export const MAX_PAGE = 200;

const BUSY = 429;
const MAX_BUSY_RETRIES = 5;
const BASE_DELAY_MS = 400;
const MAX_DELAY_MS = 4000;

/**
 * The server answers 429 while another reader or writer holds the planning lock (for example
 * right after "Armar la semana", when two screens refetch at once). That is "try again in a
 * moment", never an error screen, so those reads wait and retry with a growing pause.
 */
const WHEN_BUSY = {
  retry: (failures: number, error: unknown) =>
    error instanceof ApiError && error.status === BUSY && failures < MAX_BUSY_RETRIES,
  retryDelay: (failures: number) => Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** failures),
};

export interface ScheduleFilter {
  week: string;
  day?: string;
  courier?: string;
  pageSize: number;
}

/** Tasks of a week (or a day) with the load per courier. Server-side filters only. */
export function scheduleOptions(client: ApiClient, identity: SessionIdentity, f: ScheduleFilter) {
  const options = orgScopedQueryOptions(identity, {
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
  return { ...options, ...WHEN_BUSY };
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

/** Display names of staff (names only). A missing or forbidden directory never blocks the screen. */
export function couriersOptions(client: ApiClient, identity: SessionIdentity) {
  return orgScopedQueryOptions(identity, {
    key: ["people", "names"],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/lookups/users/", {
          params: { query: { page_size: MAX_PAGE } },
          signal,
        }),
      ).results,
  });
}

/** Quadrant codes and outlines (no blocks, points or history), for names and pickers. */
export function quadrantNamesOptions(client: ApiClient, identity: SessionIdentity) {
  return orgScopedQueryOptions(identity, {
    key: ["quadrants", "names"],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/lookups/quadrants/", {
          params: { query: { page_size: MAX_PAGE } },
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

/** The part of a table state the scheduling reads depend on. */
export type ListState = Pick<TableState, "page" | "filters"> &
  Partial<Pick<TableState, "sort" | "isSortExplicit">>;

/** The explicit sort of a table as the API `ordering` value. */
function orderingOf(state: ListState): string | undefined {
  const sort = state.sort;
  if (!state.isSortExplicit || !sort) return undefined;
  return `${sort.direction === "desc" ? "-" : ""}${sort.id}`;
}

export function risksOptions(
  client: ApiClient,
  identity: SessionIdentity,
  week: string,
  state: ListState,
  pageSize: number,
) {
  const code = state.filters["code"];
  const ordering = orderingOf(state);
  return orgScopedQueryOptions(identity, {
    key: ["risk", "list", week, state.page, pageSize, code ?? null, ordering ?? null],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/risk-categories/", {
          params: {
            query: {
              week,
              page: state.page,
              page_size: pageSize,
              ...(code ? { code } : {}),
              ...(ordering ? { ordering } : {}),
            },
          },
          signal,
        }),
      ),
  });
}

export function interventionsOptions(
  client: ApiClient,
  identity: SessionIdentity,
  state: ListState,
  pageSize: number,
) {
  const from = state.filters["date_from"];
  const to = state.filters["date_to"];
  const ordering = orderingOf(state);
  return orgScopedQueryOptions(identity, {
    key: [
      "interventions",
      "list",
      state.page,
      pageSize,
      from ?? null,
      to ?? null,
      ordering ?? null,
    ],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/third-party-interventions/", {
          params: {
            query: {
              page: state.page,
              page_size: pageSize,
              ...(from ? { date_from: from } : {}),
              ...(to ? { date_to: to } : {}),
              ...(ordering ? { ordering } : {}),
            },
          },
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
  const options = orgScopedQueryOptions(identity, {
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
  // Three screens read this at once; seven requests under a lock are worth reusing for a moment.
  return { ...options, ...WHEN_BUSY, staleTime: 20_000 };
}
