import { createApiClient } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";

import type { TokenStore } from "../auth/token-store.ts";

export interface MobileApiClientOptions {
  /** API origin without `/api/v1` (`parseApiBaseUrl` validates it). */
  readonly baseUrl: string;
  readonly tokens: TokenStore;
  /** Replaces the global `fetch` (tests). */
  readonly fetch?: (request: Request) => Promise<Response>;
}

/**
 * The one API client of the app: bearer token from the token store, no cookies. Every network call
 * of the app goes through it (and so through `@wolbachia/api-client`).
 */
export function createMobileApiClient(options: MobileApiClientOptions): ApiClient {
  return createApiClient({
    baseUrl: options.baseUrl,
    auth: { kind: "bearer", getAccessToken: () => options.tokens.getAccessToken() },
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
}
