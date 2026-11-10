import { unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import { GEOGRAPHY } from "../geography/geography-query";
import type { GeographyScope } from "../geography/use-w-15";

const PAGE_SIZE = 200;
/** The editor draws a bounded organization map; stop after this many pages. */
const MAX_PAGES = 25;

interface Page<T> {
  results: T[];
  next?: string | null;
}

async function loadAll<T>(load: (page: number) => Promise<Page<T>>, signal: AbortSignal) {
  const rows: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    signal.throwIfAborted();
    const answer = await load(page);
    rows.push(...answer.results);
    if (!answer.next) break;
  }
  return rows;
}

const query = (page: number) => ({ page, page_size: PAGE_SIZE });

export function editorQuadrantsOptions(scope: GeographyScope) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "editor", "quadrants"],
    queryFn: ({ signal }) =>
      loadAll<Schemas["Quadrant"]>(
        async (page) =>
          unwrap(
            await scope.client.GET("/api/v1/quadrants/", {
              params: { query: query(page) },
              signal,
            }),
          ),
        signal,
      ),
  });
}

export function editorBlocksOptions(scope: GeographyScope) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "editor", "blocks"],
    queryFn: ({ signal }) =>
      loadAll<Schemas["Block"]>(
        async (page) =>
          unwrap(
            await scope.client.GET("/api/v1/blocks/", { params: { query: query(page) }, signal }),
          ),
        signal,
      ),
  });
}

export function editorPointsOptions(scope: GeographyScope) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "editor", "points"],
    queryFn: ({ signal }) =>
      loadAll<Schemas["SamplingPoint"]>(
        async (page) =>
          unwrap(
            await scope.client.GET("/api/v1/sampling-points/", {
              params: { query: query(page) },
              signal,
            }),
          ),
        signal,
      ),
  });
}

export function editorReleasePointsOptions(scope: GeographyScope) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "editor", "release-points"],
    queryFn: ({ signal }) =>
      loadAll<Schemas["ReleasePoint"]>(
        async (page) =>
          unwrap(
            await scope.client.GET("/api/v1/release-points/", {
              params: { query: query(page) },
              signal,
            }),
          ),
        signal,
      ),
  });
}

/** Permit zones only feed a warning; a missing permission simply hides it. */
export function editorPermitsOptions(scope: GeographyScope) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "editor", "permits"],
    queryFn: ({ signal }) =>
      loadAll<Schemas["Permit"]>(
        async (page) =>
          unwrap(
            await scope.client.GET("/api/v1/permits/", { params: { query: query(page) }, signal }),
          ),
        signal,
      ),
  });
}
