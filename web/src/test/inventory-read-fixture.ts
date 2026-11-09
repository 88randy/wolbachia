import {
  inventorySupply,
  inventoryLocation,
  inventoryLot,
  inventoryPage,
  inventoryMovement,
  INVENTORY_CENTER,
  INVENTORY_LOCATION,
  INVENTORY_SUPPLY,
  INVENTORY_OWNER,
  INVENTORY_OPERATION,
} from "./inventory-fixtures";
export const inventoryPreviewPermissions = [
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

export interface InventoryReadState {
  lot: ReturnType<typeof inventoryLot>;
  locationRows: ReturnType<typeof inventoryLocation>[];
  readonly emptyStockLocations?: ReadonlySet<string>;
}
function stock(state: InventoryReadState, location = inventoryLocation()) {
  return inventoryPage(
    state.emptyStockLocations?.has(location.id)
      ? []
      : [
          {
            lot: state.lot.id,
            lot_code: state.lot.code,
            supply: state.lot.supply,
            piece_id: null,
            quantity: "2",
            unit: "piece",
            source_ids: [INVENTORY_OPERATION],
          },
        ],
  );
}
function movement(state: InventoryReadState, location = inventoryLocation()) {
  return inventoryMovement({
    lot_id: state.lot.id,
    lot_code: state.lot.code,
    supply_id: state.lot.supply,
    location_id: location.id,
    location_code: location.code,
    ...(location.id !== INVENTORY_LOCATION
      ? {
          source_kind: "transfer_receive",
          source_id: "cd000000-0000-0000-0000-000000000099",
          source_transfer: null,
        }
      : {}),
  });
}
function lot(state: InventoryReadState, query: URLSearchParams) {
  const site = query.get("custody_location");
  return { ...state.lot, ...(site ? { safety_location_id: site } : {}) };
}
function placement(state: InventoryReadState, query: URLSearchParams) {
  const option =
    query.get("action") === "location.create"
      ? { kind: "center_only", quadrant_id: null, code: null }
      : {
          kind: "location",
          location_id: INVENTORY_LOCATION,
          quadrant_id: null,
          code: "LOC-01",
          is_read_only: Boolean(state.lot.admission_id),
        };
  return inventoryPage([option]);
}
type Reader = (state: InventoryReadState, query: URLSearchParams) => unknown;
const readers = new Map<string, Reader>([
  [
    "/api/v1/centers/",
    () => inventoryPage([{ id: INVENTORY_CENTER, code: "C-01", name: "Synthetic center" }]),
  ],
  ["/api/v1/supply-types/", () => inventoryPage([inventorySupply()])],
  [`/api/v1/supply-types/${INVENTORY_SUPPLY}/`, () => inventorySupply()],
  ["/api/v1/supply-types/protocol-incident-type-options/", () => inventoryPage([])],
  ["/api/v1/lots/", (state, query) => inventoryPage([lot(state, query)])],
  ["/api/v1/locations/", (state) => inventoryPage(state.locationRows)],
  [
    "/api/v1/locations/owner-options/",
    () => inventoryPage([{ membership_id: INVENTORY_OWNER, label: "Synthetic owner" }]),
  ],
  ["/api/v1/locations/placement-options/", placement],
  [`/api/v1/locations/${INVENTORY_LOCATION}/stock/`, (state) => stock(state)],
  [
    `/api/v1/locations/${INVENTORY_LOCATION}/movements/`,
    (state) => inventoryPage([movement(state)]),
  ],
]);
export const inventoryPreviewReadPaths = [...readers.keys()];
/** Shared151 read payloads only: no SQL filtering, policy, write engine or real transport. */
export function inventoryReadFixture(state: InventoryReadState, path: string) {
  const url = new URL(path, "http://127.0.0.1");
  if (url.pathname === `/api/v1/lots/${state.lot.id}/`) return lot(state, url.searchParams);
  const location = state.locationRows.find((row) =>
    [`/api/v1/locations/${row.id}/stock/`, `/api/v1/locations/${row.id}/movements/`].includes(
      url.pathname,
    ),
  );
  if (location)
    return url.pathname.endsWith("/stock/")
      ? stock(state, location)
      : inventoryPage([movement(state, location)]);
  const reader = readers.get(url.pathname);
  if (!reader) throw new Error("Unsupported inventory fixture GET " + url.pathname);
  return reader(state, url.searchParams);
}
