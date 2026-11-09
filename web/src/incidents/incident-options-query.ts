import { unwrap } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { IncidentScope } from "./incidents-query";
export function incidentTypeOptions(scope: IncidentScope, page: number) {
  return {
    ...orgScopedQueryOptions(scope.identity, {
      key: ["incidents", "types", page],
      queryFn: async ({ signal }) =>
        unwrap(
          await scope.client.GET("/api/v1/incident-types/", {
            params: { query: { page, page_size: 25 } },
            signal,
          }),
        ),
    }),
    placeholderData: undefined,
  };
}
export function incidentContextOptions(
  scope: IncidentScope,
  query: { page: number; search: string },
) {
  return {
    ...orgScopedQueryOptions(scope.identity, {
      key: ["incidents", "contexts", query],
      queryFn: async ({ signal }) =>
        unwrap(
          await scope.client.GET("/api/v1/incidents/context-options/", {
            params: { query: { ...query, action: "read", page_size: 25 } },
            signal,
          }),
        ),
    }),
    placeholderData: undefined,
  };
}
