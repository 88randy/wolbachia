import type { Page, Route } from "@playwright/test";
import { expect } from "./test";
import { mockApi } from "./mock-api";
import { makeMe } from "../../src/test/fake-api";
import {
  inventorySupply,
  inventoryLocation,
  inventoryLot,
  inventoryPage,
  INVENTORY_CENTER,
  INVENTORY_OWNER,
  INVENTORY_OPERATION,
  INVENTORY_ADMISSION,
  INVENTORY_TIME,
} from "../../src/test/inventory-fixtures";
const permissions = [
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
export class InventoryMock {
  readonly writes: {
    method: string;
    path: string;
    body: unknown;
    csrf?: string;
    organization?: string;
  }[] = [];
  readonly reads: string[] = [];
  lot = inventoryLot();
  locationRows = [inventoryLocation()];
  private record(route: Route) {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET") this.reads.push(request.url());
    else
      this.writes.push({
        method: request.method(),
        path,
        body: request.postDataJSON() as unknown,
        csrf: request.headers()["x-csrftoken"],
        organization: request.headers()["x-organization"],
      });
    return { method: request.method(), path };
  }
  supply = async (route: Route) => {
    const { path } = this.record(route);
    if (path.endsWith("/protocol-incident-type-options/"))
      return route.fulfill({ json: inventoryPage([]) });
    return route.fulfill({
      json:
        path === "/api/v1/supply-types/" ? inventoryPage([inventorySupply()]) : inventorySupply(),
    });
  };
  lots = async (route: Route) => {
    const { method } = this.record(route);
    if (method === "POST") return this.createLot(route);
    if (method === "PATCH") return this.completeLot(route);
    return route.fulfill({ json: inventoryPage([this.lot]) });
  };
  private createLot(route: Route) {
    expect(route.request().postDataJSON()).toMatchObject({
      code: "LOT-NEW",
      supply_id: inventorySupply().id,
      center_id: INVENTORY_CENTER,
      quantity: "2",
      initial_location_id: inventoryLocation().id,
      expected_revision: 0,
    });
    this.lot = inventoryLot({ code: "LOT-NEW", revision: 1 });
    return route.fulfill({ status: 201, json: this.lot });
  }
  private completeLot(route: Route) {
    expect(route.request().postDataJSON()).toMatchObject({
      expected_revision: 1,
      species: "Authored species",
    });
    this.lot = inventoryLot({
      code: "LOT-NEW",
      revision: 2,
      species: "Authored species",
      missing_fields: [],
      admission_id: INVENTORY_ADMISSION,
      status: "blocked",
      blocked_by: [{ reason: "condition_slot_missing", unblocked_by_role: "warehouse", link: "" }],
    });
    return route.fulfill({ json: this.lot });
  }
  locations = async (route: Route) => {
    const { path } = this.record(route);
    if (path.endsWith("/owner-options/"))
      return route.fulfill({
        json: inventoryPage([{ membership_id: INVENTORY_OWNER, label: "Synthetic owner" }]),
      });
    if (path.endsWith("/placement-options/")) return this.placement(route);
    return this.locationRead(route, path);
  };
  private placement(route: Route) {
    const action = new URL(route.request().url()).searchParams.get("action");
    const option =
      action === "location.create"
        ? { kind: "center_only", quadrant_id: null, code: null }
        : {
            kind: "location",
            location_id: inventoryLocation().id,
            quadrant_id: null,
            code: "LOC-01",
            is_read_only: Boolean(this.lot.admission_id),
          };
    return route.fulfill({ json: inventoryPage([option]) });
  }
  private locationRead(route: Route, path: string) {
    if (path.endsWith("/stock/"))
      return route.fulfill({
        json: inventoryPage([
          {
            lot: this.lot.id,
            lot_code: this.lot.code,
            supply: this.lot.supply,
            piece_id: null,
            quantity: "2",
            unit: "piece",
            source_ids: [INVENTORY_OPERATION],
          },
        ]),
      });
    if (path.endsWith("/movements/"))
      return route.fulfill({ json: inventoryPage([this.movement()]) });
    return route.fulfill({ json: inventoryPage(this.locationRows) });
  }
  private movement() {
    return {
      id: "00000000-0000-4000-8000-000000000012",
      operation_id: INVENTORY_OPERATION,
      line_number: 1,
      lot_id: this.lot.id,
      lot_code: this.lot.code,
      supply_id: this.lot.supply,
      location_id: inventoryLocation().id,
      location_code: "LOC-01",
      piece_id: null,
      quantity: "2",
      unit: "piece",
      unit_version_id: inventorySupply().version,
      source_kind: "lot_admission",
      source_id: INVENTORY_ADMISSION,
      created_at: INVENTORY_TIME,
      created_by: null,
    };
  }
}
export async function installInventoryApi(page: Page) {
  await page.addInitScript(() => {
    document.cookie = "csrftoken=e2e-csrf; path=/";
    localStorage.setItem("wolbachia.organization", "norte");
  });
  await mockApi(page, {
    me: makeMe({
      permissions,
      scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
    }),
  });
  const server = new InventoryMock();
  await page.route("**/api/v1/centers/**", (route) =>
    route.fulfill({
      json: inventoryPage([{ id: INVENTORY_CENTER, code: "C-01", name: "Synthetic center" }]),
    }),
  );
  await page.route("**/api/v1/supply-types/**", server.supply);
  await page.route("**/api/v1/lots/**", server.lots);
  await page.route("**/api/v1/locations/**", server.locations);
  return server;
}
