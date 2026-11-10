import { createFakeApi, makeMe } from "./fake-api";
import type { FakeApiRoutes, RecordedRequest } from "./fake-api";
import { renderApp } from "./render-app";
import type { Me } from "../session/me";
import {
  inventoryLot,
  inventorySupply,
  inventoryLocation,
  inventoryPage,
  INVENTORY_CENTER,
  INVENTORY_OWNER,
} from "./inventory-fixtures";
export const inventoryPermissions = [
  "supply_type.read",
  "supply_type.create",
  "supply_type.update",
  "supply_type.deactivate",
  "lot.read",
  "lot.create",
  "lot.update",
  "location.read",
  "location.create",
  "location.update",
  "center.read",
];
export function inventoryMe(overrides: Partial<Me> = {}) {
  return makeMe({
    permissions: inventoryPermissions,
    scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
    ...overrides,
  });
}
function readLots(request: RecordedRequest) {
  const location = new URL(request.path, "https://test.invalid").searchParams.get(
    "custody_location",
  );
  return Response.json(
    inventoryPage([inventoryLot(location ? { safety_location_id: location } : {})]),
  );
}
function readLot(request: RecordedRequest) {
  const location = new URL(request.path, "https://test.invalid").searchParams.get(
    "custody_location",
  );
  return Response.json(inventoryLot({ safety_location_id: location ?? inventoryLocation().id }));
}
function placements() {
  return Response.json(
    inventoryPage([
      {
        kind: "location",
        location_id: inventoryLocation().id,
        quadrant_id: null,
        code: "LOC-01",
        is_read_only: false,
      },
    ]),
  );
}
export function inventoryApi(routes: FakeApiRoutes = {}, me = inventoryMe()) {
  return createFakeApi({
    "GET /api/v1/me/": () => Response.json(me),
    "GET /api/v1/centers/": () =>
      Response.json(
        inventoryPage([{ id: INVENTORY_CENTER, code: "C-01", name: "Synthetic center" }]),
      ),
    "GET /api/v1/supply-types/": () => Response.json(inventoryPage([inventorySupply()])),
    [`GET /api/v1/supply-types/${inventorySupply().id}/`]: () => Response.json(inventorySupply()),
    "GET /api/v1/lots/": readLots,
    [`GET /api/v1/lots/${inventoryLot().id}/`]: readLot,
    "GET /api/v1/locations/": () => Response.json(inventoryPage([inventoryLocation()])),
    "GET /api/v1/locations/owner-options/": () =>
      Response.json(inventoryPage([{ membership_id: INVENTORY_OWNER, label: "Synthetic owner" }])),
    "GET /api/v1/locations/placement-options/": placements,
    "GET /api/v1/supply-types/protocol-incident-type-options/": () =>
      Response.json(inventoryPage([])),
    ...routes,
  });
}
export async function openInventory(options: {
  path: string;
  routes?: FakeApiRoutes;
  me?: Me;
  language?: "es-MX" | "en";
}) {
  const api = inventoryApi(options.routes, options.me);
  const app = await renderApp({
    path: options.path,
    fetch: api.fetch,
    ...(options.language ? { language: options.language } : {}),
  });
  return { api, app };
}
