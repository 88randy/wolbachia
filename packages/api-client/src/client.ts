import createClient, { type Middleware } from "openapi-fetch";

import type { paths } from "./generated/schema.ts";

/** Header Django reads the CSRF token from (docs/api-conventions.md, "Auth"). */
export const CSRF_HEADER = "X-CSRFToken";
/** Header that selects the active organization of a multi-organization user. */
export const ORGANIZATION_HEADER = "X-Organization";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", "TRACE"]);

export type ApiAuth =
  /** Web: Django session cookie; the CSRF token is sent on unsafe methods only. */
  | { kind: "session"; getCsrfToken: () => string | undefined }
  /** Mobile: `Authorization: Bearer <access token>`; no cookies. Refresh lives in #4/#6. */
  | { kind: "bearer"; getAccessToken: () => string | undefined | Promise<string | undefined> };

export interface ApiClientOptions {
  /** Origin of the API without the `/api/v1` prefix (paths already include it). */
  baseUrl: string;
  auth: ApiAuth;
  /** Slug of the active organization; sent as `X-Organization` while it returns a value. */
  getOrganizationSlug?: () => string | undefined;
  /** Replaces the global `fetch` (tests, React Native polyfills). */
  fetch?: (request: Request) => Promise<Response>;
}

export type ApiClient = ReturnType<typeof createClient<paths>>;

async function applyAuth(request: Request, auth: ApiAuth): Promise<void> {
  if (auth.kind === "bearer") {
    const token = await auth.getAccessToken();
    if (token !== undefined) request.headers.set("Authorization", `Bearer ${token}`);
    return;
  }
  const token = auth.getCsrfToken();
  if (token !== undefined && !SAFE_METHODS.has(request.method.toUpperCase())) {
    request.headers.set(CSRF_HEADER, token);
  }
}

function authMiddleware(options: ApiClientOptions): Middleware {
  return {
    async onRequest({ request }) {
      await applyAuth(request, options.auth);
      const slug = options.getOrganizationSlug?.();
      if (slug !== undefined && slug !== "") request.headers.set(ORGANIZATION_HEADER, slug);
      return request;
    },
  };
}

/**
 * Creates the one typed client of an app. Calls are `client.GET("/api/v1/me/")` and so on: paths,
 * params, bodies and responses are typed from the OpenAPI schema, and non-2xx responses are
 * typed as `ErrorEnvelope`. Token refresh is added by the app with `client.use(middleware)`.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    credentials: options.auth.kind === "session" ? "same-origin" : "omit",
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  client.use(authMiddleware(options));
  return client;
}
