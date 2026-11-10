import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import { invalidateOrgScoped, orgScopedQueryOptions } from "../../session/org-scoped-query";
import type { SessionIdentity } from "../../session/org-scoped-query";
import type { QueryClient } from "@tanstack/react-query";
import type { TableState } from "../../data-table/table-types";
export type IncidentType = Schemas["IncidentType"];
export type UnconfiguredType = Schemas["IncidentTypeUnconfiguredItem"];
export type TypeTarget = IncidentType | UnconfiguredType;
export function isConfiguredType(item: TypeTarget | undefined): item is IncidentType {
  return item !== undefined && "revision" in item;
}
export interface TypeScope {
  client: ApiClient;
  identity: SessionIdentity;
}
export const MANAGE_TYPE = "incident.manage_type";
export const TYPE_PAGE_SIZE = 25;
const ROOT = "incident-types";
function scoped<T>(scope: TypeScope, options: Parameters<typeof orgScopedQueryOptions<T>>[1]) {
  const result = orgScopedQueryOptions(scope.identity, options);
  return {
    ...result,
    enabled: result.enabled && scope.identity.permissions?.includes(MANAGE_TYPE) === true,
  };
}
export function typesOptions(scope: TypeScope, state: TableState) {
  return scoped(scope, {
    key: [ROOT, "list", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/incident-types/", {
          params: {
            query: {
              page: state.page,
              page_size: TYPE_PAGE_SIZE,
              ...(state.filters["code"] ? { code: state.filters["code"] } : {}),
              ...(state.isSortExplicit && state.sort
                ? { ordering: `${state.sort.direction === "desc" ? "-" : ""}${state.sort.id}` }
                : {}),
            },
          },
          signal,
        }),
      ),
  });
}
export function typeOptions(scope: TypeScope, code: string) {
  return {
    ...scoped(scope, {
      key: [ROOT, "code", code],
      queryFn: async ({ signal }) =>
        unwrap(
          await scope.client.GET("/api/v1/incident-types/", {
            params: { query: { code, page: 1, page_size: TYPE_PAGE_SIZE } },
            signal,
          }),
        ),
    }),
    enabled:
      scope.identity.isSettled &&
      scope.identity.permissions?.includes(MANAGE_TYPE) === true &&
      code !== "",
  };
}
export function unconfiguredOptions(scope: TypeScope, request: { page: number; code?: string }) {
  return scoped(scope, {
    key: [ROOT, "unconfigured", request],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/incident-types/unconfigured-items/", {
          params: { query: { ...request, page_size: TYPE_PAGE_SIZE } },
          signal,
        }),
      ),
  });
}
export function ownersOptions(scope: TypeScope, query: { page: number; search: string }) {
  return scoped(scope, {
    key: [ROOT, "owners", query],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/incident-types/owner-options/", {
          params: { query: { ...query, page_size: TYPE_PAGE_SIZE } },
          signal,
        }),
      ),
  });
}
export function ownerSelectionOptions(scope: TypeScope, membershipId: string) {
  return {
    ...scoped(scope, {
      key: [ROOT, "owner", membershipId],
      queryFn: async ({ signal }) =>
        unwrap(
          await scope.client.GET("/api/v1/incident-types/owner-options/", {
            params: { query: { membership_id: membershipId, page_size: 1 } },
            signal,
          }),
        ),
    }),
    enabled:
      scope.identity.isSettled &&
      scope.identity.permissions?.includes(MANAGE_TYPE) === true &&
      membershipId !== "",
  };
}
export function typeHistoryOptions(scope: TypeScope, query: { id: string; page: number }) {
  return scoped(scope, {
    key: [ROOT, "history", query],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/incident-types/{id}/versions/", {
          params: {
            path: { id: query.id },
            query: { page: query.page, page_size: TYPE_PAGE_SIZE },
          },
          signal,
        }),
      ),
  });
}
export function invalidateTypes(client: QueryClient) {
  return invalidateOrgScoped(client, ROOT);
}
export function typeEditorKey(identity: SessionIdentity) {
  return `${identity.userId}|${identity.organizationSlug}|${identity.authorization ?? ""}|${identity.activeCenter ?? ""}`;
}
