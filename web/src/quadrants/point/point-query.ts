import { unwrap } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import { GEOGRAPHY } from "../geography/geography-query";
import type { GeographyScope } from "../geography/use-w-15";

/** Most rows read for one point. A point gets one check a week, so this is years of history. */
export const POINT_PAGE_SIZE = 100;

const key = (scope: GeographyScope, ...parts: (string | number)[]) =>
  [GEOGRAPHY, scope.context, "point-page", ...parts] as const;

/** The point of a quadrant by its human code. The quadrant filter keeps a point of another quadrant out. */
export function pointOptions(scope: GeographyScope, quadrantId: string, code: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: key(scope, "point", quadrantId, code),
    queryFn: async ({ signal }) => {
      const answer = unwrap(
        await scope.client.GET("/api/v1/sampling-points/", {
          params: { query: { quadrant: quadrantId, code } },
          signal,
        }),
      );
      return answer.results.find((point) => point.code === code) ?? null;
    },
  });
}

/** The block of the point, only for its outline on the map. */
export function pointBlockOptions(scope: GeographyScope, blockId: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: key(scope, "block", blockId),
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/blocks/{id}/", {
          params: { path: { id: blockId } },
          signal,
        }),
      ),
  });
}

/** Every ovitrap that has been at the point, voided ones included (the screen decides what to hide). */
export function pointOvitrapsOptions(scope: GeographyScope, pointId: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: key(scope, "ovitraps", pointId),
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/ovitraps/", {
          params: { query: { point: pointId, status: "all", page_size: POINT_PAGE_SIZE } },
          signal,
        }),
      ),
  });
}

/** The checks done at the point, newest first; each one carries its bag code when it has a paddle. */
export function pointReadingsOptions(scope: GeographyScope, pointId: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: key(scope, "readings", pointId),
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/readings/", {
          params: {
            query: { point: pointId, status: "all", page_size: POINT_PAGE_SIZE },
          },
          signal,
        }),
      ),
  });
}

/** Placements, replacements, relocations and removals at the point (the history is per point, any trap of it works). */
export function pointLifecycleOptions(scope: GeographyScope, ovitrapId: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: key(scope, "lifecycle", ovitrapId),
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/ovitraps/{id}/history/", {
          params: { path: { id: ovitrapId } },
          signal,
        }),
      ),
  });
}
