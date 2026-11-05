import { createApiClient } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import type { AppConfig } from "../config/app-config";
import { attestationMiddleware } from "../session/attestation";
import { getOrganizationSlug } from "../session/organization-slug";

/** Django's default CSRF cookie name. [ASSUMPTION] until backend #4 says otherwise. */
export const CSRF_COOKIE_NAME = "csrftoken";

const API_PREFIX = "/api/v1";

/**
 * The api-client wants the API origin WITHOUT `/api/v1` (its paths already include it), while
 * `VITE_API_BASE_URL` is the full base. A same-origin path is resolved against the page origin.
 */
export function apiOriginOf(apiBaseUrl: string, pageOrigin: string): string {
  const url = new URL(apiBaseUrl, pageOrigin);
  const path = url.pathname.replace(/\/+$/, "");
  const prefixless = path.endsWith(API_PREFIX) ? path.slice(0, -API_PREFIX.length) : path;
  return `${url.origin}${prefixless}`;
}

/** Value of one cookie, or undefined. */
export function readCookie(name: string, cookies: string): string | undefined {
  const entry = cookies.split("; ").find((part) => part.startsWith(`${name}=`));
  return entry === undefined ? undefined : decodeURIComponent(entry.slice(name.length + 1));
}

interface WebApiClientOptions {
  /** Replaces the global fetch (tests). */
  fetch?: (request: Request) => Promise<Response>;
}

/**
 * The one API client of the web app: same-origin session cookie plus the CSRF header on unsafe
 * methods. `organization_id` is never sent by the web: the active organization is the user's only
 * one, or the slug they chose, sent as the `X-Organization` header (docs/api-conventions.md).
 */
export function createWebApiClient(
  config: AppConfig,
  options: WebApiClientOptions = {},
): ApiClient {
  const client = createApiClient({
    baseUrl: apiOriginOf(config.apiBaseUrl, window.location.origin),
    auth: { kind: "session", getCsrfToken: () => readCookie(CSRF_COOKIE_NAME, document.cookie) },
    getOrganizationSlug,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  // The one fetch layer: every response is checked against the identity it was issued under.
  client.use(attestationMiddleware);
  return client;
}
