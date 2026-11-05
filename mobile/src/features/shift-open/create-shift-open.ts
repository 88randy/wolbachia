import { unwrap } from "@wolbachia/api-client";
import { randomUUID } from "expo-crypto";
import { createMobileApiClient } from "../../api/create-api-client.ts";
import type { TokenStore } from "../../auth/token-store.ts";
import type { ServerSettings } from "../../config/server-settings.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import { readCatalogSnapshot, readRulesSnapshot } from "./catalog-snapshot.ts";
import { UNAVAILABLE_MAP } from "./domain.ts";
import { ShiftOpenService } from "./service.ts";
import { ShiftOpenStore } from "./store.ts";

interface Dependencies {
  readonly db: SqlExecutor;
  readonly engine: SyncEngine;
  readonly server: ServerSettings;
  readonly tokens: TokenStore;
}
async function downloadCatalog(deps: Dependencies, store: ShiftOpenStore): Promise<void> {
  const baseUrl = deps.server.baseUrl();
  if (baseUrl === null || deps.tokens.getAccessToken() === undefined)
    throw new Error("Catalog unavailable without a server and session.");
  const client = createMobileApiClient({ baseUrl, tokens: deps.tokens });
  const access = deps.tokens.getAccessToken();
  const signal = AbortSignal.timeout(30_000);
  const catalog = readCatalogSnapshot(
    unwrap(await client.GET("/api/v1/field/catalog/", { signal })),
  );
  if (access !== deps.tokens.getAccessToken() || baseUrl !== deps.server.baseUrl())
    throw new Error("Catalog session changed.");
  await store.saveCatalog(catalog);
  const rules = readRulesSnapshot(unwrap(await client.GET("/api/v1/field/rules/", { signal })));
  if (access !== deps.tokens.getAccessToken() || baseUrl !== deps.server.baseUrl())
    throw new Error("Rules session changed.");
  await store.saveRules(rules);
}
/** One feature wiring point; B-13 and native camera support deliberately remain truthful unavailable ports. */
export function createShiftOpen(deps: Dependencies): ShiftOpenService {
  const store = new ShiftOpenStore(deps.db);
  return new ShiftOpenService({
    store,
    engine: deps.engine,
    now: () => new Date(),
    uuid: randomUUID,
    maps: { prepare: () => Promise.resolve(UNAVAILABLE_MAP) },
    photos: { capture: () => Promise.resolve({ status: "unavailable" }) },
    refreshCatalog: () => downloadCatalog(deps, store),
  });
}
