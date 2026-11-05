import { createMobileApiClient } from "../api/create-api-client.ts";
import type { MobileApiClientOptions } from "../api/create-api-client.ts";
import type { TokenStore } from "../auth/token-store.ts";
import { createSyncTransport } from "./sync-transport.ts";
import type { SyncTransport } from "./sync-transport.ts";
interface Options {
  readonly baseUrl: () => string | null;
  readonly tokens: TokenStore;
  readonly fetch?: MobileApiClientOptions["fetch"];
}
/** A response belongs to the pinned token/server that started it; stale answers cannot install downloaded access. */
export function createScopedSyncTransport(options: Options): SyncTransport {
  return async (request) => {
    const baseUrl = options.baseUrl();
    if (baseUrl === null) return { ok: false, failure: { kind: "network" } };
    const access = options.tokens.getAccessToken();
    const client = createMobileApiClient({
      baseUrl,
      tokens: options.tokens,
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    });
    const result = await createSyncTransport(client)(request);
    if (access !== options.tokens.getAccessToken() || baseUrl !== options.baseUrl())
      return { ok: false, failure: { kind: "network" } };
    // Preserve successful response metadata, including final-upload revocation.
    return result;
  };
}
