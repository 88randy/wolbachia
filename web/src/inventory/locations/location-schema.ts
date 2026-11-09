import { z } from "zod";
import type { Schemas } from "@wolbachia/api-client";
import type { InventoryValues } from "../inventory-fields";
import { nullableFlag } from "../supplies/supply-schema";
const locationSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  center_id: z.string().min(1),
  owner_id: z.string().min(1),
  kind: z.enum(["biofactory", "warehouse", "center"]),
});
/** GeoJSON uses longitude,latitude; unknown safety never becomes true. */
export function locationPayload(
  values: InventoryValues,
  previous?: Schemas["Location"],
): Schemas["LocationWriteRequest"] {
  if (!values["longitude"]?.trim() || !values["latitude"]?.trim())
    throw new Error("required_coordinates");
  const longitude = z.coerce.number().min(-180).max(180).parse(values["longitude"]);
  const latitude = z.coerce.number().min(-90).max(90).parse(values["latitude"]);
  return {
    ...locationSchema.parse(values),
    expected_revision: previous?.revision ?? 0,
    quadrant_id:
      values["quadrant_id"] && values["quadrant_id"] !== "none" ? values["quadrant_id"] : null,
    geometry: { type: "Point", coordinates: [longitude, latitude] },
    is_insecticide_free: nullableFlag(values["is_insecticide_free"]),
  };
}
