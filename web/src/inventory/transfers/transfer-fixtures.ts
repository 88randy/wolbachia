import type { Schemas } from "@wolbachia/api-client";
import { inventoryMe } from "../../test/inventory-api";
import { INVENTORY_LOCATION, INVENTORY_LOT, INVENTORY_TIME } from "../../test/inventory-fixtures";
export const TRANSFER_ID = "15200000-0000-4000-8000-000000000001";
export const TRANSFER_LINE_ID = "15200000-0000-4000-8000-000000000002";
export const TRANSFER_PIECE_ID = "15200000-0000-4000-8000-000000000003";
export const TRANSFER_SIGNATURE_ID = "15200000-0000-4000-8000-000000000004";
export function transferMe() {
  return inventoryMe({
    permissions: [
      "transfer.read",
      "transfer.dispatch",
      "transfer.receive",
      "discrepancy.read",
      "discrepancy.close",
      "field.upload",
    ],
  });
}
export function transferLine(
  overrides: Partial<Schemas["TransferLine"]> = {},
): Schemas["TransferLine"] {
  return {
    id: TRANSFER_LINE_ID,
    lot_id: INVENTORY_LOT,
    piece_id: null,
    unit_version_id: "15200000-0000-4000-8000-000000000005",
    quantity: "1",
    origin_version_id: "15200000-0000-4000-8000-000000000006",
    destination_version_id: "15200000-0000-4000-8000-000000000007",
    ...overrides,
  };
}
export function transferEvent(
  overrides: Partial<Schemas["TransferEvent"]> = {},
): Schemas["TransferEvent"] {
  return {
    id: "15200000-0000-4000-8000-000000000008",
    transfer_id: TRANSFER_ID,
    revision: 2,
    kind: "dispatch",
    command_id: "15200000-0000-4000-8000-000000000009",
    manifest: { evidence: [] },
    manifest_hash: "synthetic-signed-manifest",
    device_time: INVENTORY_TIME,
    server_received_at: INVENTORY_TIME,
    declared_source_uuid: null,
    operation_id: null,
    discrepancy_id: null,
    created_by: null,
    created_at: INVENTORY_TIME,
    ...overrides,
  };
}
export function transfer(overrides: Partial<Schemas["Transfer"]> = {}): Schemas["Transfer"] {
  return {
    id: TRANSFER_ID,
    code: "T-152",
    origin_id: INVENTORY_LOCATION,
    destination_id: "15200000-0000-4000-8000-000000000010",
    lines: [transferLine()],
    events: [transferEvent()],
    revision: 2,
    state: "dispatched",
    outstanding: {},
    created_by: null,
    created_at: INVENTORY_TIME,
    ...overrides,
  };
}
