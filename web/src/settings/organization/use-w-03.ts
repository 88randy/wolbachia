import { ORGANIZATION_READ, ROLE_READ } from "./permissions";
import type { QueryFunction } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import type { TableState } from "../../data-table/table-types";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import type { SessionIdentity } from "../../session/org-scoped-query";
import { ADMIN_PAGE_SIZE } from "./admin-table";
/** Org-wide configuration requires its action code and a settled session, not a center grant. */
function adminScopedOptions<T>(
  identity: SessionIdentity,
  request: { key: readonly unknown[]; queryFn: QueryFunction<T>; permission: string },
) {
  const options = orgScopedQueryOptions(identity, request);
  return {
    ...options,
    enabled: options.enabled && identity.permissions?.includes(request.permission) === true,
  };
}
export type Profile = Schemas["Profile"];
export type Membership = Schemas["Membership"];
export type Organization = Schemas["OrganizationSettings"];
export interface AdminContext {
  client: ApiClient;
  identity: SessionIdentity;
}
function paging(state: TableState) {
  const sort = state.sort;
  return {
    page: state.page,
    page_size: ADMIN_PAGE_SIZE,
    ...(state.isSortExplicit && sort
      ? { ordering: `${sort.direction === "desc" ? "-" : ""}${sort.id}` }
      : {}),
  };
}
export function rolesOptions({ client, identity }: AdminContext, state: TableState) {
  return adminScopedOptions(identity, {
    permission: ROLE_READ,
    key: ["administration", "roles", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/roles/", {
          params: { query: { ...paging(state), search: state.filters["search"] } },
          signal,
        }),
      ),
  });
}
export function membersOptions({ client, identity }: AdminContext, state: TableState) {
  const active = state.filters["is_active"];
  const profile = state.filters["profiles"];
  return adminScopedOptions(identity, {
    permission: ROLE_READ,
    key: ["administration", "memberships", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/memberships/", {
          params: {
            query: {
              ...paging(state),
              ...(profile ? { profiles: profile } : {}),
              ...(active === undefined ? {} : { is_active: active === "true" }),
            },
          },
          signal,
        }),
      ),
  });
}
export function organizationOptions({ client, identity }: AdminContext) {
  return adminScopedOptions(identity, {
    permission: ORGANIZATION_READ,
    key: ["administration", "organization"],
    queryFn: async ({ signal }) => unwrap(await client.GET("/api/v1/organization/", { signal })),
  });
}
/** Backend lacks fixed-profile metadata: fail closed for empty and exclusively portal bundles. */
export function isReadOnlyProfile(profile: Profile): boolean {
  return (
    !profile.is_active ||
    profile.permissions.every((permission) => permission.startsWith("portal."))
  );
}
