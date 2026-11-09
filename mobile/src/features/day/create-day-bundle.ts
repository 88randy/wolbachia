import type { TokenStore } from "../../auth/token-store.ts";
import type { CredentialStore } from "../../auth/credential-store.ts";
import type { SessionRequests } from "../../auth/session-requests.ts";
import { createScopedApiClient } from "../../api/create-scoped-api-client.ts";
import type { MobileApiClientOptions } from "../../api/create-api-client.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import { DayBundleService } from "./bundle-service.ts";
import { createBootstrapTransport } from "./bootstrap-transport.ts";
import { DayStore } from "./store.ts";
import type { EvidenceIdentity } from "../../attachments/evidence-session.ts";
interface Dependencies {
  readonly db: SqlExecutor;
  readonly fetch?: MobileApiClientOptions["fetch"];
  readonly tokens: TokenStore & Pick<CredentialStore, "getSnapshot">;
  readonly requests: () => SessionRequests;
  readonly getCaptureIdentity?: () => EvidenceIdentity | null;
}
export function createDayBundle(deps: Dependencies): DayBundleService {
  return new DayBundleService({
    store: new DayStore(deps.db),
    now: () => new Date(),
    getScopeKey: () => sessionScope(deps.tokens),
    getTransportKey: () => transportScope(deps.tokens),
    ...(deps.getCaptureIdentity === undefined
      ? {}
      : { getCaptureIdentity: deps.getCaptureIdentity }),
    transport: async (etag) => {
      const baseUrl = deps.tokens.getOrigin();
      const scope = sessionScope(deps.tokens);
      if (baseUrl === null || scope === null)
        throw new Error("Bootstrap requires a server and session.");
      const result = await createBootstrapTransport(
        createScopedApiClient({
          tokens: deps.tokens,
          ...(deps.fetch ? { fetch: deps.fetch } : {}),
        }),
        deps.requests(),
      )(etag);
      if (scope !== sessionScope(deps.tokens)) throw new Error("Bootstrap session changed.");
      return result;
    },
  });
}
function sessionScope(tokens: Dependencies["tokens"]): string | null {
  const current = tokens.getSnapshot();
  return current.status === "active" ? transportScope(tokens) : null;
}
/** A retained final pair proves this transport turn only; never a capture/read grant. */
function transportScope(tokens: Dependencies["tokens"]): string | null {
  const current = tokens.getSnapshot();
  return current.pair !== null && current.sessionId !== null && current.origin !== null
    ? JSON.stringify([current.sessionId, current.origin])
    : null;
}
