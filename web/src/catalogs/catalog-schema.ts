import { z } from "zod";
const CODE_MAX = 64;
const LABEL_MAX = 200;
const code = z
  .string()
  .trim()
  .min(1, "catalogs.error.code")
  .max(CODE_MAX, "catalogs.error.code")
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "catalogs.error.code")
  .refine((value) => value !== "other", "catalogs.error.reserved");
export const catalogCreateSchema = z.object({
  code,
  label_es: z.string().trim().min(1, "catalogs.error.label").max(LABEL_MAX, "catalogs.error.label"),
  label_en: z.string().trim().max(LABEL_MAX, "catalogs.error.label"),
});

export type CatalogValues = z.infer<typeof catalogCreateSchema>;
