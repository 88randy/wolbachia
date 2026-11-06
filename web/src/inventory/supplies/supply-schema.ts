import { z } from "zod";
import type { Schemas } from "@wolbachia/api-client";
import type { InventoryValues } from "../inventory-fields";
import { dirtyInventoryValues } from "../inventory-form-values";
import { biologicalFields, protocolValuesOf } from "../inventory-protocol";
import { isProtocolField } from "../inventory-fields";
const supplyIdentity = z.object({
  code: z.string().trim().min(1).max(50),
  label: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(24),
  identity_kind: z.enum(["piece", "lot"]),
  is_biological: z.boolean(),
});
const decimals = z.string().regex(/^-?\d+(?:\.\d{1,6})?$/);
export function nullableFlag(value: string | undefined) {
  return value === "true" ? true : value === "false" ? false : null;
}
function nullableDecimal(value: string | undefined) {
  return value ? decimals.parse(value) : null;
}
function minuteValue(value: string) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(value)) throw new Error("invalid_window");
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
function readingWindows(values: InventoryValues) {
  const windows = ["window1_start", "window1_end", "window2_start", "window2_end"].map(
    (key) => values[key] ?? "",
  );
  if (windows.every((value) => value === "")) return [];
  const [first = 0, second = 0, third = 0, fourth = 0] = windows.map(minuteValue);
  if (first >= second || second > third || third >= fourth) throw new Error("invalid_windows");
  return [
    [first, second],
    [third, fourth],
  ];
}
export function protocolPayload(values: InventoryValues): Schemas["ProtocolWriteRequest"] {
  const shelf = values["shelf_life_seconds"]
    ? z.coerce.number().int().positive().parse(values["shelf_life_seconds"])
    : null;
  return {
    name: values["protocol_name"] ?? "",
    shelf_life_seconds: shelf,
    expiry_basis: z.enum(["", "laid_on"]).parse(values["expiry_basis"] ?? ""),
    temperature_min: nullableDecimal(values["temperature_min"]),
    temperature_max: nullableDecimal(values["temperature_max"]),
    humidity_min: nullableDecimal(values["humidity_min"]),
    humidity_max: nullableDecimal(values["humidity_max"]),
    reading_windows: readingWindows(values),
    required_fields: z
      .array(z.enum(biologicalFields))
      .parse(values["required_fields"]?.split(",").filter(Boolean) ?? []),
    incident_type_id: values["incident_type_id"] || null,
  };
}
export function supplyPayload(
  values: InventoryValues,
  previous?: Schemas["Supply"],
): Schemas["SupplyWriteRequest"] {
  const base = supplyIdentity.parse({
    ...values,
    is_biological: z.enum(["true", "false"]).parse(values["is_biological"]) === "true",
  });
  const dirty = dirtyInventoryValues(values, previous);
  const hasProtocolEdit = Object.keys(dirty).some(isProtocolField);
  if (hasProtocolEdit && previous?.protocol && !protocolValuesOf(previous.protocol))
    throw new Error("unreadable_protocol");
  return {
    ...base,
    expected_revision: previous?.revision ?? 0,
    is_chemical: nullableFlag(values["is_chemical"]),
    expiry_required: nullableFlag(values["expiry_required"]),
    requires_insecticide_free: nullableFlag(values["requires_insecticide_free"]),
    specification: values["specification"] ?? "",
    ...(hasProtocolEdit ? { protocol: protocolPayload(values) } : {}),
  };
}
