import type { MessageKey } from "@wolbachia/i18n";
import { z } from "zod";

/**
 * Sign-in form. Messages are catalog KEYS (the schema returns a code, the text comes from i18n).
 * The username is trimmed (an autofill often adds a space; usernames have none at the edges);
 * the password is sent exactly as typed.
 */
export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, { error: "auth.login.usernameRequired" satisfies MessageKey }),
  password: z.string().min(1, { error: "auth.login.passwordRequired" satisfies MessageKey }),
});

export type LoginValues = z.infer<typeof loginSchema>;
