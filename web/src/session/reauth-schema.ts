import type { MessageKey } from "@wolbachia/i18n";
import { z } from "zod";

/** Re-authentication asks only for the password: the username is the signed-in user's. */
export const reauthSchema = z.object({
  password: z.string().min(1, { error: "auth.login.passwordRequired" satisfies MessageKey }),
});

export type ReauthValues = z.infer<typeof reauthSchema>;
