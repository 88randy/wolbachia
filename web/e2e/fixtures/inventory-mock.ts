import type { Page, Route } from "@playwright/test";
import { expect } from "./test";
import { mockApi } from "./mock-api";
import { makeMe } from "../../src/test/fake-api";
import {
  inventorySupply,
  inventoryLocation,
  inventoryLot,
  INVENTORY_CENTER,
  INVENTORY_ADMISSION,
} from "../../src/test/inventory-fixtures";
import {
  inventoryReadFixture,
  inventoryPreviewPermissions,
} from "../../src/test/inventory-read-fixture";
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
  read = async (route: Route) => {
    const { method } = this.record(route);
    if (method !== "GET") throw new Error("Unsupported inventory fixture " + method);
    return route.fulfill({ json: inventoryReadFixture(this, route.request().url()) });
  };
  lots = async (route: Route) => {
    const { method } = this.record(route);
    if (method === "POST") return this.createLot(route);
    if (method === "PATCH") return this.completeLot(route);
    if (method !== "GET") throw new Error("Unsupported inventory fixture " + method);
    return route.fulfill({ json: inventoryReadFixture(this, route.request().url()) });
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
}
export async function installInventoryApi(page: Page) {
  await page.addInitScript(() => {
    document.cookie = "csrftoken=e2e-csrf; path=/";
    localStorage.setItem("wolbachia.organization", "norte");
  });
  await mockApi(page, {
    me: makeMe({
      permissions: inventoryPreviewPermissions,
      scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
    }),
  });
  const server = new InventoryMock();
  await page.route("**/api/v1/centers/**", server.read);
  await page.route("**/api/v1/supply-types/**", server.read);
  await page.route("**/api/v1/lots/**", server.lots);
  await page.route("**/api/v1/locations/**", server.read);
  return server;
}
