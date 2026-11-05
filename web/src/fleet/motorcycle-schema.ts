import { z } from "zod";
// Existing #72 write contract; these are field lengths, not configurable business thresholds.
export const MOTORCYCLE_CODE_MAX = 50;
export const MOTORCYCLE_PLATE_MAX = 20;
export const motorcycleSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "fleet.create.invalidCode")
    .max(MOTORCYCLE_CODE_MAX, "fleet.create.invalidCode"),
  plate: z.string().trim().max(MOTORCYCLE_PLATE_MAX, "fleet.create.invalidPlate"),
});
export type MotorcycleValues = z.infer<typeof motorcycleSchema>;
