import { centerQuery, centerIdentity } from "../centers/center-filter";
import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import type { TableState } from "../data-table/table-types";
import type { Me } from "../session/me";
import { invalidateOrgScoped } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";
import { FLEET_PAGE_SIZE } from "./fleet-table";
import { assertFleetRead, fleetScopedOptions } from "./use-fleet-scope";
export type Motorcycle = Schemas["Motorcycle"];
export type MotorcycleDetail = Schemas["MotorcycleDetail"];
// All fleet keys and invalidation live here, on orgScopedQueryOptions (#82): the key carries the
// session identity and previous data is never reused across identities.
const ROOT = "fleet";
/** Who asks and through which client; the identity goes into the key. */
export interface FleetScope {
  client: ApiClient;
  identity: SessionIdentity;
  urlCenter?: string;
  context?: string;
  isCurrent?: () => boolean;
}

/** Session-owned scope, never a route or API filter. Used as the remount key of the screens. */
export function fleetIdentity(me: Me): string {
  return `${me.user.id}|${me.organization?.id ?? ""}|${me.organization?.slug ?? ""}`;
}
function fleetListParams(identity: SessionIdentity, state: TableState) {
  const blocked = state.filters["is_blocked"];
  return {
    ...centerQuery(identity, state.filters["center"]),
    page: state.page,
    page_size: FLEET_PAGE_SIZE,
    include_voided: state.includeVoided,
    ...(state.isSortExplicit && state.sort
      ? { ordering: `${state.sort.direction === "desc" ? "-" : ""}${state.sort.id}` }
      : {}),
    ...(blocked === undefined ? {} : { is_blocked: blocked === "true" }),
  };
}
/** Only supported server filters; no client-side sorting or filtering. */
export function fleetListOptions(scope: FleetScope, state: TableState) {
  const { client, identity } = scope;
  return fleetScopedOptions(
    { ...scope, identity: centerIdentity(identity, state.filters["center"]) },
    [ROOT, "list", state, identity.activeCenter ?? null],
    async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/motorcycles/", {
          params: { query: fleetListParams(identity, state) },
          signal,
        }),
      ),
  );
}
/** Scoped human-code lookup precedes the actual UUID detail and its authoritative metrics. */
export function fleetRecordOptions(scope: FleetScope, code: string) {
  const { client, identity, urlCenter } = scope;
  return fleetScopedOptions(
    { ...scope, identity: centerIdentity(identity, urlCenter) },
    [ROOT, "record", code, urlCenter ?? null, identity.activeCenter ?? null],
    async ({ signal }) => {
      const page = unwrap(
        await client.GET("/api/v1/motorcycles/", {
          params: {
            query: { code, include_voided: true, page: 1, ...centerQuery(identity, urlCenter) },
          },
          signal,
        }),
      );
      const found = page.results.find((row) => row.code === code);
      if (!found) return null;
      assertFleetRead(scope, signal);
      const detail = unwrap(
        await client.GET("/api/v1/motorcycles/{id}/", {
          params: { path: { id: found.id } },
          signal,
        }),
      );
      return detail.id === found.id && detail.code === code && detail.center === found.center
        ? detail
        : null;
    },
  );
}
/** Stale writes never invalidate a new identity's results. */
export function invalidateFleet(queryClient: QueryClient): Promise<void> {
  return invalidateOrgScoped(queryClient, ROOT);
}
