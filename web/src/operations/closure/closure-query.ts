import { unwrap } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import type { GeographyScope } from "../../quadrants/geography/use-w-15";
export const CLOSURE = "quadrant-closure";
export function readinessOptions(scope: GeographyScope, id: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: [CLOSURE, scope.context, id],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/quadrants/{id}/closure/", {
          params: { path: { id } },
          signal,
        }),
      ),
  });
}
