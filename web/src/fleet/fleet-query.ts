import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import type { TableState } from "../data-table/table-types";
import type { Me } from "../session/me";
import { invalidateOrgScoped, orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";
import { FLEET_PAGE_SIZE } from "./fleet-table";
export type Motorcycle = Schemas["Motorcycle"];
// All fleet keys and invalidation live here, on orgScopedQueryOptions (#82): the key carries the
// session identity and previous data is never reused across identities.
const ROOT = "fleet";
/** Who asks and through which client; the identity goes into the key. */
export interface FleetScope {
  client: ApiClient;
  identity: SessionIdentity;
}

/** Session-owned scope, never a route or API filter. Used as the remount key of the screens. */
export function fleetIdentity(me: Me): string {
  return `${me.user.id}|${me.organization?.id ?? ""}|${me.organization?.slug ?? ""}`;
}
/** Only supported server filters; no client-side sorting or filtering. */
export function fleetListOptions({ client, identity }: FleetScope, state: TableState) {
  const blocked = state.filters["is_blocked"];
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "list", state.page, blocked ?? null, state.includeVoided],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/motorcycles/", {
          params: {
            query: {
              page: state.page,
              page_size: FLEET_PAGE_SIZE,
              include_voided: state.includeVoided,
              ...(blocked === undefined ? {} : { is_blocked: blocked === "true" }),
            },
          },
          signal,
        }),
      ),
  });
}
/** Exact scoped code lookup; the returned item is the detail. */
export function fleetRecordOptions({ client, identity }: FleetScope, code: string) {
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "record", code],
    queryFn: async ({ signal }) => {
      const page = unwrap(
        await client.GET("/api/v1/motorcycles/", {
          params: { query: { code, include_voided: true, page: 1 } },
          signal,
        }),
      );
      return page.results[0] ?? null;
    },
  });
}
/** Stale writes never invalidate a new identity's results. */
export function invalidateFleet(queryClient: QueryClient): Promise<void> {
  return invalidateOrgScoped(queryClient, ROOT);
}
