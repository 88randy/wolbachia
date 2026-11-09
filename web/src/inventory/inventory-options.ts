import { unwrap } from "@wolbachia/api-client";
import { assertInventoryAction, inventoryScopedOptions } from "./inventory-read-context";
import type { InventoryScope } from "./inventory-query";
export interface OptionRequest {
  kind: "centers" | "supplies" | "owners" | "placements" | "protocols";
  center?: string;
  quadrant?: string;
  location?: string;
  lot?: string;
  supply?: string;
  action?: "location.create" | "lot.create";
}
export function optionReady(request: OptionRequest) {
  if (request.kind === "owners")
    return Boolean(request.location || (request.center && request.quadrant));
  if (request.kind === "placements")
    return Boolean(request.lot || (request.center && request.action));
  return true;
}
function optionPermission(request: OptionRequest) {
  if (request.kind === "centers") return "center.read";
  if (request.kind === "supplies") return "supply_type.read";
  if (request.kind === "protocols")
    return request.supply ? "supply_type.update" : "supply_type.create";
  if (request.kind === "owners") return request.location ? "location.update" : "location.create";
  return request.lot ? "lot.update" : (request.action ?? "");
}
const paths = {
  centers: "/api/v1/centers/",
  supplies: "/api/v1/supply-types/",
  protocols: "/api/v1/supply-types/protocol-incident-type-options/",
  owners: "/api/v1/locations/owner-options/",
  placements: "/api/v1/locations/placement-options/",
} as const;
function targetOf(request: OptionRequest) {
  if (request.kind === "supplies") return { is_active: "true" as const };
  if (request.kind === "protocols") return request.supply ? { supply: request.supply } : {};
  if (request.kind === "owners")
    return request.location
      ? { location: request.location }
      : { center: request.center, quadrant: request.quadrant };
  if (request.kind === "placements")
    return request.lot ? { lot: request.lot } : { center: request.center, action: request.action };
  return {};
}
/** Closed query shapes: generic table filters never leak into an option endpoint. */
export function inventoryOptionOptions(
  scope: InventoryScope,
  request: OptionRequest,
  paging: { page: number; search: string },
) {
  const allowed = scope.identity.permissions?.includes(optionPermission(request)) ?? false;
  const identity = {
    ...scope.identity,
    isSettled:
      scope.identity.isSettled &&
      optionReady(request) &&
      allowed &&
      scope.readContext?.mode !== "custody",
  };
  return inventoryScopedOptions(
    { ...scope, identity },
    {
      key: ["inventory", "options", request, paging],
      queryFn: ({ signal }) => readInventoryOptionPage(scope, { request, paging }, signal),
    },
  );
}
export async function readInventoryOptionPage(
  scope: InventoryScope,
  target: { request: OptionRequest; paging: { page: number; search: string } },
  signal: AbortSignal,
) {
  const { request, paging } = target;
  assertInventoryAction(scope, signal);
  const query = { ...paging, page_size: 25, ...targetOf(request) };
  return unwrap(await scope.client.GET(paths[request.kind], { params: { query }, signal }));
}
