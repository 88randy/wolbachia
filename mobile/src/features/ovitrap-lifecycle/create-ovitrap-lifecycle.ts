import { unwrap } from "@wolbachia/api-client";
import { randomUUID } from "expo-crypto";
import { createMobileApiClient } from "../../api/create-api-client.ts";
import type { CredentialStore } from "../../auth/credential-store.ts";
import type { TokenStore } from "../../auth/token-store.ts";
import type { SessionRequests } from "../../auth/session-requests.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import type { ShiftOpenService } from "../shift-open/service.ts";
import type { EvidencePort, GpsPort } from "../ovitrap-check/types.ts";
import { captureShiftId } from "../ovitrap-check/shift-authorization.ts";
import { readLifecycleCatalog, readLifecycleRules } from "./snapshots.ts";
import { LifecycleService } from "./service.ts";
import { LifecycleStore } from "./store.ts";
interface Dependencies {
  readonly db: SqlExecutor;
  readonly engine: SyncEngine;
  readonly tokens: TokenStore & Pick<CredentialStore, "getSnapshot">;
  readonly requests: SessionRequests;
  readonly shiftOpen: Pick<ShiftOpenService, "read">;
  readonly gps?: GpsPort;
  readonly evidence?: EvidencePort;
}
async function download(deps: Dependencies, store: LifecycleStore): Promise<void> {
  const session = deps.tokens.getSnapshot();
  const baseUrl = deps.tokens.getOrigin();
  if (!baseUrl || session.status !== "active")
    throw new Error("Configuration requires an active pinned session.");
  const client = createMobileApiClient({ baseUrl, tokens: deps.tokens });
  const signal = AbortSignal.timeout(30_000);
  const catalog = readLifecycleCatalog(
    unwrap(await deps.requests.run(() => client.GET("/api/v1/field/catalog/", { signal }))),
  );
  const rules = readLifecycleRules(
    unwrap(await deps.requests.run(() => client.GET("/api/v1/field/rules/", { signal }))),
  );
  const current = deps.tokens.getSnapshot();
  if (
    current.status !== "active" ||
    current.sessionId !== session.sessionId ||
    current.origin !== session.origin
  )
    throw new Error("Lifecycle configuration session changed.");
  await store.saveConfiguration({ catalog, rules });
}
export function createOvitrapLifecycle(deps: Dependencies): LifecycleService {
  const store = new LifecycleStore(deps.db);
  return new LifecycleService({
    store,
    engine: deps.engine,
    uuid: randomUUID,
    now: () => new Date(),
    shiftId: async () => captureShiftId(await deps.shiftOpen.read()),
    gps: deps.gps ?? { locate: () => Promise.resolve(null) },
    evidence: deps.evidence ?? { capture: () => Promise.resolve(null) },
    refresh: () => download(deps, store),
  });
}
