import { unwrap } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { IncidentScope } from "./incidents-query";

export function incidentOwnerOptions(
  scope: IncidentScope,
  target: { id: string; page: number; search: string; isOpen: boolean },
) {
  return {
    ...orgScopedQueryOptions(scope.identity, {
      key: ["incidents", "owners", target],
      queryFn: async ({ signal }) =>
        unwrap(
          await scope.client.GET("/api/v1/incidents/{id}/owner-options/", {
            params: {
              path: { id: target.id },
              query: { page: target.page, page_size: 25, search: target.search },
            },
            signal,
          }),
        ),
    }),
    enabled: scope.identity.isSettled && target.isOpen,
  };
}
