import { centerQuery, centerIdentity } from "../../centers/center-filter";
import { unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import type { TableState } from "../../data-table/table-types";
import { listParams, resourceParams, PAGE_SIZE } from "./geography-table";
import { coversRecord } from "./permissions";
import { revisionHistoryParams, pointHistoryParams } from "./history-query-params";
import type { GeographyScope } from "./use-w-15";
export const GEOGRAPHY = "geography";
export function quadrantListOptions(scope: GeographyScope, state: TableState) {
  return orgScopedQueryOptions(centerIdentity(scope.identity, state.filters["center"]), {
    key: [GEOGRAPHY, scope.context, "quadrants", state, scope.identity.activeCenter ?? null],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/quadrants/", {
          params: {
            query: {
              ...listParams(state),
              ...state.filters,
              ...centerQuery(scope.identity, state.filters["center"]),
            },
          },
          signal,
        }),
      ),
  });
}
export function quadrantRecordOptions(scope: GeographyScope, code: string) {
  return orgScopedQueryOptions(centerIdentity(scope.identity, scope.urlCenter), {
    key: [
      GEOGRAPHY,
      scope.context,
      "record",
      code,
      scope.urlCenter ?? null,
      scope.identity.activeCenter ?? null,
    ],
    queryFn: async ({ signal }) => {
      const answer = unwrap(
        await scope.client.GET("/api/v1/quadrants/", {
          params: { query: { code, page: 1, ...centerQuery(scope.identity, scope.urlCenter) } },
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
export function historyOptions(
  scope: GeographyScope,
  quadrant: string,
  pageOrState: number | TableState,
) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "history", quadrant, pageOrState],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/quadrants/{id}/versions/", {
          params: { path: { id: quadrant }, query: revisionHistoryParams(pageOrState) },
          signal,
        }),
      ),
  });
}
export function blocksOptions(
  scope: GeographyScope,
  quadrant: string,
  pageOrState: number | TableState,
) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "blocks", quadrant, pageOrState],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/blocks/", {
          params: { query: { quadrant, ...resourceParams(pageOrState) } },
          signal,
        }),
      ),
  });
}
export function pointsOptions(
  scope: GeographyScope,
  quadrant: string,
  pageOrState: number | TableState,
) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "points", quadrant, pageOrState],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/sampling-points/", {
          params: { query: { quadrant, ...resourceParams(pageOrState) } },
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
export function pointHistoryOptions(
  scope: GeographyScope,
  point: string,
  pageOrState: number | TableState,
) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "point-history", point, pageOrState],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/sampling-points/{id}/versions/", {
          params: { path: { id: point }, query: pointHistoryParams(pageOrState) },
          signal,
        }),
      ),
  });
}
export function blockHistoryOptions(
  scope: GeographyScope,
  block: string,
  pageOrState: number | TableState,
) {
  return orgScopedQueryOptions(scope.identity, {
    key: [GEOGRAPHY, scope.context, "block-history", block, pageOrState],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/blocks/{id}/versions/", {
          params: { path: { id: block }, query: revisionHistoryParams(pageOrState) },
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
