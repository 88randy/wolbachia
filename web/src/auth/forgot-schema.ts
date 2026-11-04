import type { MessageKey } from "@wolbachia/i18n";
import { z } from "zod";

const EMAIL_INVALID = "auth.forgot.emailInvalid" satisfies MessageKey;

/** Request form of the password reset. Messages are catalog keys. */
export const forgotSchema = z.object({
  email: z
    .string()
    .trim()
    .pipe(z.email({ error: EMAIL_INVALID })),
});

export type ForgotValues = z.infer<typeof forgotSchema>;
