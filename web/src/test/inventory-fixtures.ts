import type { Schemas } from "@wolbachia/api-client";
export const INVENTORY_CENTER = "00000000-0000-4000-8000-000000000001";
export const INVENTORY_LOCATION = "00000000-0000-4000-8000-000000000002";
export const INVENTORY_SUPPLY = "00000000-0000-4000-8000-000000000003";
export const INVENTORY_LOT = "00000000-0000-4000-8000-000000000004";
export const INVENTORY_PROTOCOL = "00000000-0000-4000-8000-000000000005";
export const INVENTORY_OWNER = "00000000-0000-4000-8000-000000000006";
export const INVENTORY_OPERATION = "00000000-0000-4000-8000-000000000007";
export const INVENTORY_ADMISSION = "00000000-0000-4000-8000-000000000008";
export const INVENTORY_TIME = "2026-11-06T12:00:00Z";
export function inventoryProtocol(): Schemas["Protocol"] {
  return {
    id: INVENTORY_PROTOCOL,
    name: "Synthetic protocol",
    shelf_life_seconds: 864000,
    expiry_basis: "laid_on",
    temperature_min: "20",
    temperature_max: "30",
    humidity_min: "50",
    humidity_max: "90",
    reading_windows: [
      [480, 540],
      [960, 1020],
    ],
    required_fields: [],
    incident_type_id: null,
    incident_type: null,
    created_by: null,
    created_at: INVENTORY_TIME,
  };
}
export function inventorySupply(overrides: Partial<Schemas["Supply"]> = {}): Schemas["Supply"] {
  return {
    id: INVENTORY_SUPPLY,
    code: "SUP-01",
    version: "00000000-0000-4000-8000-000000000009",
    revision: 1,
    label: "Synthetic supply",
    unit: "piece",
    identity_kind: "piece",
    is_biological: true,
    is_chemical: false,
    requires_insecticide_free: true,
    expiry_required: true,
    specification: "",
    is_active: true,
    protocol: inventoryProtocol(),
    created_by: null,
    created_at: INVENTORY_TIME,
    ...overrides,
  };
}
export function inventoryLocation(
  overrides: Partial<Schemas["Location"]> = {},
): Schemas["Location"] {
  return {
    id: INVENTORY_LOCATION,
    code: "LOC-01",
    version: "00000000-0000-4000-8000-000000000010",
    revision: 1,
    center: INVENTORY_CENTER,
    quadrant: null,
    quadrant_code: null,
    name: "Synthetic store",
    kind: "warehouse",
    geometry: { type: "Point", coordinates: [-99, 19] },
    owner_id: INVENTORY_OWNER,
    owner_label: "Synthetic owner",
    is_insecticide_free: true,
    created_by: null,
    created_at: INVENTORY_TIME,
    ...overrides,
  };
}
const LOT_BASE: Schemas["Lot"] = {
  id: INVENTORY_LOT,
  code: "LOT-01",
  version: "00000000-0000-4000-8000-000000000011",
  revision: 2,
  supply: INVENTORY_SUPPLY,
  supply_version_id: "00000000-0000-4000-8000-000000000009",
  supply_version: inventorySupply(),
  admission_id: null,
  center: INVENTORY_CENTER,
  quadrant: null,
  protocol_id: INVENTORY_PROTOCOL,
  initial_location_id: INVENTORY_LOCATION,
  safety_location_id: INVENTORY_LOCATION,
  location_version_id: "00000000-0000-4000-8000-000000000010",
  location_version: {
    id: "00000000-0000-4000-8000-000000000010",
    location_id: INVENTORY_LOCATION,
    code: "LOC-01",
    name: "Synthetic store",
  },
  quantity: "2",
  provenance: "Synthetic provenance",
  species: "",
  strain: "",
  generation: "",
  laid_on: null,
  estimated_organism_count: null,
  observations: "",
  expiry: null,
  expiry_date: null,
  timezone: "America/Mexico_City",
  status: "draft",
  missing_fields: ["species"],
  blocked_by: [],
  stock_url: `/api/v1/locations/${INVENTORY_LOCATION}/stock/?lot=${INVENTORY_LOT}`,
  created_by: null,
  created_at: INVENTORY_TIME,
};
export function inventoryLot(overrides: Partial<Schemas["Lot"]> = {}): Schemas["Lot"] {
  return { ...LOT_BASE, supply_version: inventorySupply(), ...overrides };
}
export function inventoryPage<T>(results: T[], count = results.length) {
  return { count, next: null, previous: null, results };
}
export function inventoryMovement(
  overrides: Partial<Schemas["Movement"]> = {},
): Schemas["Movement"] {
  return {
    id: "00000000-0000-4000-8000-000000000012",
    operation_id: INVENTORY_OPERATION,
    line_number: 1,
    lot_id: INVENTORY_LOT,
    lot_code: "LOT-01",
    supply_id: INVENTORY_SUPPLY,
    location_id: INVENTORY_LOCATION,
    location_code: "LOC-01",
    piece_id: null,
    quantity: "2",
    unit: "piece",
    unit_version_id: inventorySupply().version,
    source_kind: "lot_admission",
    source_id: INVENTORY_ADMISSION,
    source_transfer: null,
    source_supply: null,
    created_at: INVENTORY_TIME,
    created_by: null,
    ...overrides,
  };
}
