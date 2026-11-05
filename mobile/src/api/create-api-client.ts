import { createApiClient } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";

import type { TokenStore } from "../auth/token-store.ts";

export interface MobileApiClientOptions {
  /** API origin without `/api/v1` (`parseApiBaseUrl` validates it). */
  readonly baseUrl: string;
  readonly tokens?: TokenStore;
  /** Replaces the global `fetch` (tests). */
  readonly fetch?: (request: Request) => Promise<Response>;
}

/**
 * The one API client of the app: bearer token from the token store, no cookies. Every network call
 * of the app goes through it (and so through `@wolbachia/api-client`).
 */
export function createMobileApiClient(options: MobileApiClientOptions): ApiClient {
  const baseUrl =
    options.tokens === undefined ? options.baseUrl : (options.tokens.getOrigin() ?? "");
  const client = createApiClient({
    baseUrl,
    // A client created for an older session must never attach a replacement origin's bearer.
    auth: {
      kind: "bearer",
      getAccessToken: () =>
        options.tokens?.getOrigin() === baseUrl ? options.tokens.getAccessToken() : undefined,
    },
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
  client.use({
    onRequest: ({ request }) => {
      assertBearerOrigin(request, options.tokens);
      return request;
    },
  });
  return client;
}

/** Covers explicit final-upload headers too, after generated auth middleware has run. */
function assertBearerOrigin(request: Request, tokens: TokenStore | undefined): void {
  if (tokens === undefined || !request.headers.has("Authorization")) return;
  const origin = tokens.getOrigin();
  if (origin === null || new URL(request.url).origin !== new URL(origin).origin)
    throw new Error("Refusing a bearer request outside its issuing origin.");
}
