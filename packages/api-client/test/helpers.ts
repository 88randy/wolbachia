import type { ApiAuth, ApiClientOptions } from "../src/index.ts";
import { createApiClient } from "../src/index.ts";

export const BASE_URL = "https://api.example.test";

export const ME = {
  user: {
    id: "7d444840-9dc0-4f0a-9d3a-9c3f7e0f3a01",
    username: "ana",
    email: "ana@example.test",
    first_name: "Ana",
    last_name: "Lopez",
  },
  organization: null,
  profiles: [],
  permissions: [],
  scope: { centers: { mode: "none", ids: [] }, quadrants: { mode: "none", ids: [] } },
  organizations: [{ slug: "acme", name: "Acme" }],
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A fetch that records every request and answers with `respond` (default: `ME`). */
export function recordingFetch(respond: () => Response = () => jsonResponse(ME)) {
  const requests: Request[] = [];
  const fetchFake = (request: Request): Promise<Response> => {
    requests.push(request);
    return Promise.resolve(respond());
  };
  return { fetch: fetchFake, requests };
}

export const sessionAuth: ApiAuth = { kind: "session", getCsrfToken: () => "csrf-token" };
export const bearerAuth: ApiAuth = { kind: "bearer", getAccessToken: () => "access-token" };

export function clientWith(options: Partial<ApiClientOptions> & Pick<ApiClientOptions, "fetch">) {
  return createApiClient({ baseUrl: BASE_URL, auth: sessionAuth, ...options });
}
