import { createFakeApi, makeMe } from "./fake-api";
import type { FakeApiRoutes } from "./fake-api";
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
export function inventoryApi(routes: FakeApiRoutes = {}, me = inventoryMe()) {
  return createFakeApi({
    "GET /api/v1/me/": () => Response.json(me),
    "GET /api/v1/centers/": () =>
      Response.json(
        inventoryPage([{ id: INVENTORY_CENTER, code: "C-01", name: "Synthetic center" }]),
      ),
    "GET /api/v1/supply-types/": () => Response.json(inventoryPage([inventorySupply()])),
    [`GET /api/v1/supply-types/${inventorySupply().id}/`]: () => Response.json(inventorySupply()),
    "GET /api/v1/lots/": () => Response.json(inventoryPage([inventoryLot()])),
    "GET /api/v1/locations/": () => Response.json(inventoryPage([inventoryLocation()])),
    "GET /api/v1/locations/owner-options/": () =>
      Response.json(inventoryPage([{ membership_id: INVENTORY_OWNER, label: "Synthetic owner" }])),
    "GET /api/v1/locations/placement-options/": () =>
      Response.json(
        inventoryPage([
          {
            kind: "location",
            location_id: inventoryLocation().id,
            quadrant_id: null,
            code: "LOC-01",
            is_read_only: false,
          },
        ]),
      ),
    "GET /api/v1/supply-types/protocol-incident-type-options/": () =>
      Response.json(inventoryPage([])),
    ...routes,
  });
}
export async function openInventory(options: { path: string; routes?: FakeApiRoutes; me?: Me }) {
  const api = inventoryApi(options.routes, options.me);
  const app = await renderApp({ path: options.path, fetch: api.fetch });
  return { api, app };
}
