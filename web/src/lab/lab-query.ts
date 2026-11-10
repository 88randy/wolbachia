import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import type { TableState } from "../data-table/table-types";
import { toFilterParams } from "../data-table/table-state";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";
export interface LabScope {
  client: ApiClient;
  identity: SessionIdentity;
}
export type Candidate = Schemas["LabQueueCandidate"];
export type Count = Schemas["LabCount"];
export const PAGE_SIZE = 25;
/** Filter context is retained in the server's idempotent next-candidate snapshot. */
export function queueContext(scope: LabScope, state: TableState): Schemas["LabQueueQueryRequest"] {
  return {
    ...toFilterParams(state),
    ...(scope.identity.activeCenter ? { center: scope.identity.activeCenter } : {}),
  };
}
export function queueOptions(scope: LabScope, state: TableState) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["lab", "queue", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/egg-counts/queue/", {
          params: {
            query: { ...queueContext(scope, state), page: state.page, page_size: PAGE_SIZE },
          },
          signal,
        }),
      ),
  });
}
export function historyOptions(scope: LabScope, state: TableState) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["lab", "history", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/egg-counts/", {
          params: {
            query: {
              code: state.filters["code"],
              ...(scope.identity.activeCenter ? { center: scope.identity.activeCenter } : {}),
              ordering: state.sort?.direction === "asc" ? "created_at" : "-created_at",
              include_voided: state.includeVoided,
              page: state.page,
              page_size: PAGE_SIZE,
            },
          },
          signal,
        }),
      ),
  });
}
export function conflictOptions(scope: LabScope, code: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["lab", "conflict", code],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/egg-counts/", {
          params: { query: { code, page_size: 1 } },
          signal,
        }),
      ),
  });
}
export function voidContextOptions(scope: LabScope, id: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["lab", "void-context", id],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/egg-counts/{id}/void-context/", {
          params: { path: { id } },
          signal,
        }),
      ),
  });
}
