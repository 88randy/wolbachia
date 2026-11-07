import type { Schemas } from "@wolbachia/api-client";
import type { InventoryRecord } from "./inventory-links";
import type { InventoryValues } from "./inventory-fields";
import { fieldKeys } from "./inventory-fields";
import { protocolValuesOf } from "./inventory-protocol";
export function minuteText(minute: number) {
  return (
    String(Math.floor(minute / 60)).padStart(2, "0") + ":" + String(minute % 60).padStart(2, "0")
  );
}
const protocolScalars = [
  "shelf_life_seconds",
  "expiry_basis",
  "temperature_min",
  "temperature_max",
  "humidity_min",
  "humidity_max",
  "incident_type_id",
] as const;
function protocolDraft(protocol: Schemas["Protocol"] | null): InventoryValues {
  if (!protocol) return {};
  const parsed = protocolValuesOf(protocol);
  const values = Object.fromEntries(
    protocolScalars.map((key) => [key, String(protocol[key] ?? "")]),
  );
  const windows = (parsed?.reading_windows ?? []).flatMap<[string, string]>(
    ([start, end], index) => [
      ["window" + String(index + 1) + "_start", minuteText(start)],
      ["window" + String(index + 1) + "_end", minuteText(end)],
    ],
  );
  return {
    ...values,
    protocol_name: protocol.name,
    required_fields: parsed?.required_fields.join(",") ?? "",
    ...Object.fromEntries(windows),
  };
}
function recordScalars(record: InventoryRecord): InventoryValues {
  return Object.fromEntries(
    Object.entries(record)
      .filter(
        ([key, value]) =>
          key in fieldKeys &&
          (value === null || ["string", "boolean", "number"].includes(typeof value)),
      )
      .map(([key, value]) => [key, String(value ?? "")]),
  );
}
/** Exact returned facts seed fields once; later read refreshes never overwrite a draft. */
export function inventoryValuesOf(record?: InventoryRecord): InventoryValues {
  if (!record) return {};
  const values = recordScalars(record);
  if ("supply_version" in record)
    return {
      ...values,
      supply_id: record.supply,
      center_id: record.center,
      initial_location_id: record.initial_location_id ?? "none",
      ...protocolDraft(
        record.protocol_id === record.supply_version.protocol?.id
          ? record.supply_version.protocol
          : null,
      ),
    };
  if ("geometry" in record)
    return {
      ...values,
      center_id: record.center,
      quadrant_id: record.quadrant ?? "none",
      longitude: String(record.geometry.coordinates[0]),
      latitude: String(record.geometry.coordinates[1]),
    };
  return { ...values, ...protocolDraft(record.protocol) };
}
export function dirtyInventoryValues(current: InventoryValues, previous?: InventoryRecord) {
  const initial = inventoryValuesOf(previous);
  return Object.fromEntries(
    Object.entries(current).filter(([key, value]) => value !== (initial[key] ?? "")),
  );
}
