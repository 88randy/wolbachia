import { unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import type { TableState } from "../../data-table/table-types";
import { listParams, PAGE_SIZE } from "./geography-table";
import { coversRecord } from "./permissions";
import type { GeographyScope } from "./use-w-15";
export const GEOGRAPHY = "geography";
export function quadrantListOptions(scope: GeographyScope, state: TableState) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "quadrants", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/quadrants/", {
          params: { query: { ...listParams(state), ...state.filters } },
          signal,
        }),
      ),
  });
}
export function quadrantRecordOptions(scope: GeographyScope, code: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "record", code],
    queryFn: async ({ signal }) => {
      const answer = unwrap(
        await scope.client.GET("/api/v1/quadrants/", {
          params: { query: { code, page: 1 } },
          signal,
        }),
      );
      const record = answer.results.find((item) => item.code === code);
      return record && coversRecord(scope.me, record) ? record : null;
    },
  });
}
/** Validation needs every active point, including pages outside the visible points table. */
async function loadAllPoints(scope: GeographyScope, quadrant: string, signal: AbortSignal) {
  const points: Schemas["SamplingPoint"][] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    signal.throwIfAborted();
    const answer = unwrap(
      await scope.client.GET("/api/v1/sampling-points/", {
        params: { query: { quadrant, page, page_size: PAGE_SIZE } },
        signal,
      }),
    );
    points.push(...answer.results);
    hasNext = Boolean(answer.next);
    page += 1;
  }
  return points;
}
export function allPointsOptions(scope: GeographyScope, quadrant: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "validation-points", quadrant],
    queryFn: ({ signal }) => loadAllPoints(scope, quadrant, signal),
  });
}
export function historyOptions(scope: GeographyScope, quadrant: string, page: number) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "history", quadrant, page],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/quadrants/{id}/versions/", {
          params: { path: { id: quadrant }, query: { page, page_size: PAGE_SIZE } },
          signal,
        }),
      ),
  });
}
export function blocksOptions(scope: GeographyScope, quadrant: string, page: number) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "blocks", quadrant, page],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/blocks/", {
          params: { query: { quadrant, page, page_size: PAGE_SIZE } },
          signal,
        }),
      ),
  });
}
export function pointsOptions(scope: GeographyScope, quadrant: string, page: number) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "points", quadrant, page],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/sampling-points/", {
          params: { query: { quadrant, page, page_size: PAGE_SIZE } },
          signal,
        }),
      ),
  });
}
export function suggestionOptions(scope: GeographyScope, quadrant: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "suggestion", quadrant],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/blocks/suggestion/", {
          params: { query: { quadrant } },
          signal,
        }),
      ),
  });
}
export function pointHistoryOptions(scope: GeographyScope, point: string, page: number) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "point-history", point, page],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/sampling-points/{id}/versions/", {
          params: { path: { id: point }, query: { page, page_size: PAGE_SIZE } },
          signal,
        }),
      ),
  });
}
export function blockHistoryOptions(scope: GeographyScope, block: string, page: number) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "block-history", block, page],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/blocks/{id}/versions/", {
          params: { path: { id: block }, query: { page, page_size: PAGE_SIZE } },
          signal,
        }),
      ),
  });
}
export function pointRecordOptions(scope: GeographyScope, point: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "point", point],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/sampling-points/{id}/", {
          params: { path: { id: point } },
          signal,
        }),
      ),
  });
}

async function loadAllQuadrantHistory(
  scope: GeographyScope,
  quadrant: string,
  signal: AbortSignal,
) {
  const versions: Schemas["QuadrantVersion"][] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    signal.throwIfAborted();
    const answer = unwrap(
      await scope.client.GET("/api/v1/quadrants/{id}/versions/", {
        params: { path: { id: quadrant }, query: { page, page_size: PAGE_SIZE } },
        signal,
      }),
    );
    versions.push(...answer.results);
    hasNext = Boolean(answer.next);
    page += 1;
  }
  return versions;
}
export function allQuadrantHistoryOptions(scope: GeographyScope, quadrant: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "all-history", quadrant],
    queryFn: ({ signal }) => loadAllQuadrantHistory(scope, quadrant, signal),
  });
}

export function pointCodeOptions(scope: GeographyScope, code: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "point-code", code],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/sampling-points/", {
          params: { query: { code } },
          signal,
        }),
      ),
  });
}
