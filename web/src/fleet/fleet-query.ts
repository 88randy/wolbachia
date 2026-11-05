import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import { queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { TableState } from "../data-table/table-types";
import type { Me } from "../session/me";
import { FLEET_PAGE_SIZE } from "./fleet-table";
export type Motorcycle = Schemas["Motorcycle"];
// All fleet keys and invalidation live here. When orgScopedQueryOptions (#83) lands,
// this is the only file that changes. Never retain previous data across identities.
const ROOT = "fleet";
/** Session-owned scope, never a route or API filter. */
export function fleetIdentity(me: Me): string {
  return `${me.user.id}|${me.organization?.id ?? ""}|${me.organization?.slug ?? ""}`;
}
/** Only supported server filters; no client-side sorting or filtering. */
export function fleetListOptions(client: ApiClient, me: Me, state: TableState) {
  const blocked = state.filters["is_blocked"];
  return queryOptions({
    queryKey: [ROOT, fleetIdentity(me), "list", state.page, blocked ?? null, state.includeVoided],
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
export function fleetRecordOptions(client: ApiClient, me: Me, code: string) {
  return queryOptions({
    queryKey: [ROOT, fleetIdentity(me), "record", code],
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
export function invalidateFleet(queryClient: QueryClient, me: Me): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: [ROOT, fleetIdentity(me)] });
}
