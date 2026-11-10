import type { Schemas } from "@wolbachia/api-client";
import {
  inventoryLot,
  inventoryProtocol,
  INVENTORY_LOT,
  INVENTORY_LOCATION,
} from "../../test/inventory-fixtures";
export function conditionStatus(
  overrides: Partial<Schemas["ConditionStatus"]> = {},
): Schemas["ConditionStatus"] {
  return {
    lot_id: INVENTORY_LOT,
    lot_version_id: inventoryLot().version,
    protocol_id: inventoryProtocol().id,
    location_id: INVENTORY_LOCATION,
    evaluated_at: "2026-11-06T20:00:00Z",
    local_date: "2026-11-06",
    timezone: "America/Mexico_City",
    protocol: { ...inventoryProtocol(), name: "Retained protocol" },
    is_protocol_configured: true,
    slots: [
      {
        slot: 0,
        window: [480, 540],
        is_complete: true,
        reading_id: "00000000-0000-4000-8000-000000000034",
      },
      { slot: 1, window: [960, 1020], is_complete: false, reading_id: null },
    ],
    status: "blocked",
    can_create_condition: true,
    blocked_by: ["condition_breach", "condition_slot_missing"],
    blocking_incidents: [{ id: "00000000-0000-4000-8000-000000000031", code: "I-010" }],
    ...overrides,
  };
}
function historicalProtocol() {
  return {
    ...inventoryProtocol(),
    id: "00000000-0000-4000-8000-000000000032",
    name: "Historical protocol",
    temperature_min: "18",
    temperature_max: "24",
  };
}
export function conditionReading(
  overrides: Partial<Schemas["Condition"]> = {},
): Schemas["Condition"] {
  const serverReceivedAt = overrides.server_received_at ?? "2026-11-06T14:16:00Z";
  return {
    id: "00000000-0000-4000-8000-000000000030",
    lot_id: INVENTORY_LOT,
    lot_version_id: "00000000-0000-4000-8000-000000000033",
    location_version_id: inventoryLot().location_version_id,
    capture_mode: "legacy_initial",
    capture_location_id: null,
    device_time: "2026-11-06T14:15:00Z",
    server_received_at: serverReceivedAt,
    temperature_c: "30.5",
    humidity_pct: "65",
    local_date: "2026-11-06",
    slot: 0,
    timezone: "America/Mexico_City",
    evaluation: "breach",
    range: historicalProtocol(),
    incident: null,
    pending_incident: null,
    created_by: null,
    created_at: serverReceivedAt,
    ...overrides,
  };
}
