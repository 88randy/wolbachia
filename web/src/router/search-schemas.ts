import { z } from "zod";

/** Notices the sign-in page can show above the form; anything else in the URL is ignored. */
export const LOGIN_NOTICES = ["password-changed", "no-membership"] as const;

/**
 * Search parameters of the sign-in page. `redirect` is only a request: it goes through
 * `safeRedirect` before it is used. Invalid values fall back to "not set" instead of an error
 * page, because the URL is user input.
 */
export const loginSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  notice: z.enum(LOGIN_NOTICES).optional().catch(undefined),
});

export const redirectSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
});
