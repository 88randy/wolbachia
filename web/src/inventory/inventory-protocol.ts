import { z } from "zod";
import type { Schemas } from "@wolbachia/api-client";
export const biologicalFields = [
  "species",
  "strain",
  "generation",
  "laid_on",
  "estimated_organism_count",
] as const;
const arrays = z.object({
  reading_windows: z
    .array(z.tuple([z.number().int().min(0).max(1440), z.number().int().min(0).max(1440)]))
    .max(2),
  required_fields: z.array(z.enum(biologicalFields)),
});
/** Read arrays are unknown in OpenAPI; never replace unreadable persisted values on save. */
export function protocolValuesOf(protocol: Schemas["Protocol"]) {
  const result = arrays.safeParse(protocol);
  return result.success ? { ...protocol, ...result.data } : null;
}
/** A supply's configured protocol is not proof that the lot adopted it. */
export function lotProtocolOf(lot: Schemas["Lot"]) {
  const protocol = lot.supply_version.protocol;
  return lot.protocol_id !== null && protocol?.id === lot.protocol_id ? protocol : null;
}
