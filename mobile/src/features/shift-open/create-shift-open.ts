import { unwrap } from "@wolbachia/api-client";
import { createMobileApiClient } from "../../api/create-api-client.ts";
import type { TokenStore } from "../../auth/token-store.ts";
import type { CredentialStore, Credentials } from "../../auth/credential-store.ts";
import type { SessionRequests } from "../../auth/session-requests.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import { readCatalogSnapshot, readRulesSnapshot } from "./catalog-snapshot.ts";
import { UNAVAILABLE_MAP } from "./domain.ts";
import { ShiftOpenService } from "./service.ts";
import { ShiftOpenStore } from "./store.ts";

interface Dependencies {
  readonly db: SqlExecutor;
  readonly engine: SyncEngine;
  readonly tokens: TokenStore & Pick<CredentialStore, "getSnapshot">;
  readonly requests: SessionRequests;
  readonly uuid: () => string;
  readonly fetch?: (request: Request) => Promise<Response>;
}
async function downloadCatalog(deps: Dependencies, store: ShiftOpenStore): Promise<void> {
  const baseUrl = deps.tokens.getOrigin();
  const session = deps.tokens.getSnapshot();
  if (baseUrl === null || deps.tokens.getAccessToken() === undefined)
    throw new Error("Catalog unavailable without a server and session.");
  const client = createMobileApiClient({
    baseUrl,
    tokens: deps.tokens,
    ...(deps.fetch === undefined ? {} : { fetch: deps.fetch }),
  });
  const signal = AbortSignal.timeout(30_000);
  const catalog = readCatalogSnapshot(
    unwrap(await deps.requests.run(() => client.GET("/api/v1/field/catalog/", { signal }))),
  );
  requireSession(deps.tokens, session);
  await store.saveCatalog(catalog);
  requireSession(deps.tokens, session);
  const rules = readRulesSnapshot(
    unwrap(await deps.requests.run(() => client.GET("/api/v1/field/rules/", { signal }))),
  );
  requireSession(deps.tokens, session);
  await store.saveRules(rules);
}
function requireSession(tokens: Dependencies["tokens"], session: Credentials): void {
  const current = tokens.getSnapshot();
  if (
    current.status !== "active" ||
    current.sessionId !== session.sessionId ||
    current.origin !== session.origin
  )
    throw new Error("Catalog session changed.");
}
/** One feature wiring point; B-13 and native camera support deliberately remain truthful unavailable ports. */
export function createShiftOpen(deps: Dependencies): ShiftOpenService {
  const store = new ShiftOpenStore(deps.db);
  return new ShiftOpenService({
    store,
    engine: deps.engine,
    now: () => new Date(),
    uuid: deps.uuid,
    maps: { prepare: () => Promise.resolve(UNAVAILABLE_MAP) },
    photos: { capture: () => Promise.resolve({ status: "unavailable" }) },
    refreshCatalog: () => downloadCatalog(deps, store),
  });
}
