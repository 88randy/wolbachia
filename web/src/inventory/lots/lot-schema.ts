import type { Schemas } from "@wolbachia/api-client";
import { z } from "zod";
import type { InventoryValues } from "../inventory-fields";
import { dirtyInventoryValues } from "../inventory-form-values";
const optionalDecimal = z
  .string()
  .regex(/^\d+(?:\.\d{1,6})?$/)
  .refine((value) => Number(value) > 0)
  .nullable();
const nullableFields = [
  "quantity",
  "estimated_organism_count",
  "laid_on",
  "expiry_date",
  "initial_location_id",
];
export const LOT_FIELDS = [
  "code",
  "supply_id",
  "center_id",
  "initial_location_id",
  "quantity",
  "provenance",
  "species",
  "strain",
  "generation",
  "laid_on",
  "estimated_organism_count",
  "observations",
  "expiry_date",
];
function lotFieldValues(values: InventoryValues) {
  return Object.fromEntries(
    LOT_FIELDS.filter((key) => key in values).map((key) => [
      key,
      nullableFields.includes(key) && (!values[key] || values[key] === "none") ? null : values[key],
    ]),
  );
}
/** Draft completeness belongs to the backend; only identity and present field formats are mandatory. */
export function lotPayload(
  values: InventoryValues,
  previous?: Schemas["Lot"],
): Schemas["LotWriteRequest"] {
  const identity = z
    .object({
      code: z.string().trim().min(1).max(50),
      supply_id: z.string().min(1),
      center_id: z.string().min(1),
    })
    .parse(values);
  const selected = previous ? dirtyInventoryValues(values, previous) : values;
  const body = lotFieldValues(selected);
  for (const field of ["quantity", "estimated_organism_count"])
    if (field in body) optionalDecimal.parse(body[field]);
  const adopt = values["adopt_supply_version_id"]
    ? {
        supply_version_id: values["adopt_supply_version_id"],
        protocol_id: values["adopt_protocol_id"] || null,
      }
    : {};
  return { ...identity, ...body, ...adopt, expected_revision: previous?.revision ?? 0 };
}
