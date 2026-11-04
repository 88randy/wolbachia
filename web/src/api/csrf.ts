import type { ApiClient } from "@wolbachia/api-client";
import { CSRF_COOKIE_NAME, readCookie } from "./create-web-api-client";

/**
 * Asks the server to set the `csrftoken` cookie (`GET /auth/csrf/`, `204`). Inside a sign-in or
 * sign-out, pass the operation's `signal`: abandoning it must abort this request too.
 */
export async function fetchCsrfCookie(client: ApiClient, signal?: AbortSignal): Promise<void> {
  await client.GET("/api/v1/auth/csrf/", signal ? { signal } : {});
}

/** Whether the browser already holds the CSRF cookie. */
export function hasCsrfCookie(): boolean {
  return readCookie(CSRF_COOKIE_NAME, document.cookie) !== undefined;
}

/** Fetches the CSRF cookie only when it is missing (before an unsafe request such as login). */
export async function ensureCsrfCookie(client: ApiClient, signal?: AbortSignal): Promise<void> {
  if (!hasCsrfCookie()) await fetchCsrfCookie(client, signal);
}
