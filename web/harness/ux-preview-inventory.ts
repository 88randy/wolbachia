import type { FakeApi } from "../src/test/fake-api";
import {
  inventoryReadFixture,
  inventoryPreviewReadPaths,
} from "../src/test/inventory-read-fixture";
import { inventoryLot, inventoryLocation } from "../src/test/inventory-fixtures";

/** Read-only151 snapshots; unsupported methods/paths retain createFakeApi's loud failure. */
export function installInventoryPreview(fake: FakeApi) {
  const state = { lot: inventoryLot(), locationRows: [inventoryLocation()] };
  for (const path of inventoryPreviewReadPaths)
    fake.setRoute("GET " + path, (request) =>
      Response.json(inventoryReadFixture(state, request.path)),
    );
}
