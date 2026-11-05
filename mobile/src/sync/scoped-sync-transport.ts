import { createScopedApiClient } from "../api/create-scoped-api-client.ts";
import type { MobileApiClientOptions } from "../api/create-api-client.ts";
import type { CredentialStore } from "../auth/credential-store.ts";
import type { SessionRequests } from "../auth/session-requests.ts";
import type { TokenStore } from "../auth/token-store.ts";
import { createSyncTransport } from "./sync-transport.ts";
import type { SyncTransport } from "./sync-transport.ts";

interface Options {
  readonly tokens: TokenStore & Pick<CredentialStore, "getSnapshot">;
  readonly requests: SessionRequests;
  readonly fetch?: MobileApiClientOptions["fetch"];
}
/** Master owns refresh/final-upload credentials. Replacement identities invalidate queued and late answers. */
export function createScopedSyncTransport(options: Options): SyncTransport {
  return async (request) => {
    if (options.tokens.getOrigin() === null) return { ok: false, failure: { kind: "network" } };
    const session = options.tokens.getSnapshot();
    const client = createScopedApiClient(options);
    const result = await createSyncTransport(client, options.requests)(request);
    const current = options.tokens.getSnapshot();
    if (current.sessionId !== session.sessionId || current.origin !== session.origin)
      return { ok: false, failure: { kind: "network" } };
    return result;
  };
}
