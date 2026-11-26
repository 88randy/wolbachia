import { z } from "zod";

/** Address-bar state of the scheduling screens: shareable and bookmarkable. */
export const planSearchSchema = z.object({
  week: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  courier: z.string().optional(),
});

export type PlanSearch = z.infer<typeof planSearchSchema>;
