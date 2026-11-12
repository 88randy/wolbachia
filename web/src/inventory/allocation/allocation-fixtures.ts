import type { Schemas } from "@wolbachia/api-client";
import { makeVoidReasonItems } from "../../test/fake-api";
import type { FakeApiRoutes } from "../../test/fake-api";
import { inventoryMe } from "../../test/inventory-api";
import {
  inventoryLot,
  inventoryPage,
  inventorySupply,
  INVENTORY_LOT,
} from "../../test/inventory-fixtures";

export const RECON_ID = "10700000-0000-4000-8000-000000000001";
export const DISCREPANCY_ID = "10700000-0000-4000-8000-000000000002";
export const LINE_ID = "10700000-0000-4000-8000-000000000003";
export const COURIER_ID = "10700000-0000-4000-8000-000000000004";
export const BAG_ID = "10700000-0000-4000-8000-000000000005";
export const RPBI_ID = "10700000-0000-4000-8000-000000000006";
export const INTENT_ID = "10700000-0000-4000-8000-000000000007";

export function allocationMe(permissions: string[]) {
  return inventoryMe({ permissions: [...permissions, "field.upload", "user.lookup"] });
}

function frameLine(overrides: Partial<Schemas["SupplyFrameLine"]>): Schemas["SupplyFrameLine"] {
  return {
    assignment_line_id: LINE_ID,
    plan_revision: 1,
    planned: "20",
    credited: "20",
    used: "16",
    returned: "1",
    shrinkage: "1",
    difference: "2",
    delivery_variance: null,
    ...overrides,
  };
}

function assignment(): Schemas["SupplyAssignmentRead"] {
  const line = {
    id: LINE_ID,
    lot_id: INVENTORY_LOT,
    piece_id: null,
    unit_version_id: RECON_ID,
    quantity: "20",
  };
  return {
    id: RECON_ID,
    courier_id: COURIER_ID,
    origin_id: RECON_ID,
    date: "2026-11-03",
    shift_id: null,
    revision: 1,
    version_id: RECON_ID,
    planning_proof: {},
    lines: [line],
  };
}

export function reconciliation(
  lines: Partial<Schemas["SupplyFrameLine"]>[],
): Schemas["SupplyReconciliation"] {
  return {
    id: RECON_ID,
    revision: 3,
    frame_id: RECON_ID,
    discrepancy_id: DISCREPANCY_ID,
    justification_ids: [],
    frame: { assignment_id: RECON_ID, lines: lines.map(frameLine) },
    assignment: assignment(),
  };
}

export function reasonRoutes(): FakeApiRoutes {
  return {
    "GET /api/v1/catalogs/void-reason/items/": Response.json(inventoryPage(makeVoidReasonItems())),
    "GET /api/v1/lookups/users/": Response.json(inventoryPage([])),
  };
}

export function biologicalLot() {
  return inventoryLot({
    supply_version: inventorySupply({ is_biological: true, identity_kind: "lot", unit: "pieces" }),
  });
}

export function plainLot() {
  return inventoryLot({
    supply_version: inventorySupply({ is_biological: false, identity_kind: "lot", unit: "pieces" }),
  });
}
