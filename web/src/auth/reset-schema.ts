import type { MessageKey } from "@wolbachia/i18n";
import { z } from "zod";

const REQUIRED = "auth.reset.required" satisfies MessageKey;
const MISMATCH = "auth.reset.mismatch" satisfies MessageKey;

/**
 * New password and its confirmation. Strength rules live in the server's validators (the single
 * source of truth); here only the two checks the server cannot make: not empty, and typed twice.
 * Messages are catalog keys. Passwords are never trimmed.
 */
export const resetSchema = z
  .object({
    newPassword: z.string().min(1, { error: REQUIRED }),
    confirmPassword: z.string().min(1, { error: REQUIRED }),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    error: MISMATCH,
    path: ["confirmPassword"],
  });

export type ResetValues = z.infer<typeof resetSchema>;
