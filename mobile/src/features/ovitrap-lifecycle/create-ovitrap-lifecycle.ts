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
import { createLifecycleSourcePort } from "./source-context.ts";
import type { LifecycleSourceTurn, LifecycleSourceOperation } from "./types.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
interface Dependencies {
  readonly db: SqlExecutor;
  readonly engine: SyncEngine;
  readonly tokens: TokenStore &
    Pick<CredentialStore, "getSnapshot" | "runExclusive" | "unlockGate" | "isUnlocked">;
  readonly bundle: DayBundleService;
  readonly requests: SessionRequests;
  readonly shiftOpen: Pick<ShiftOpenService, "read">;
  readonly gps?: GpsPort;
  readonly evidence?: EvidencePort;
}
interface ConfigurationTurn {
  readonly turn: LifecycleSourceTurn;
  readonly operation: LifecycleSourceOperation;
}
function configurationRequest(deps: Dependencies, original: ConfigurationTurn) {
  const session = deps.tokens.getSnapshot(),
    baseUrl = deps.tokens.getOrigin();
  if (!baseUrl || session.status !== "active")
    throw new Error("Configuration requires an active pinned session.");
  const client = createMobileApiClient({ baseUrl, tokens: deps.tokens }),
    signal = AbortSignal.timeout(30_000);
  return async (path: "/api/v1/field/catalog/" | "/api/v1/field/rules/") => {
    const response = await deps.requests.run(async () => {
      await original.turn.assertCurrent();
      if (!original.turn.handle.isCurrent() || !original.operation.isCurrent())
        throw new Error("Lifecycle configuration session changed.");
      if (signal.aborted) throw new Error("Lifecycle configuration request expired.");
      return client.GET(path, { signal });
    });
    const current = deps.tokens.getSnapshot();
    if (
      current.status !== "active" ||
      current.sessionId !== session.sessionId ||
      current.origin !== session.origin
    )
      throw new Error("Lifecycle configuration session changed.");
    return unwrap(response);
  };
}
async function download(
  deps: Dependencies,
  store: LifecycleStore,
  original: ConfigurationTurn,
): Promise<void> {
  const request = configurationRequest(deps, original);
  const catalog = readLifecycleCatalog(await request("/api/v1/field/catalog/"));
  const rules = readLifecycleRules(await request("/api/v1/field/rules/"));
  await original.operation.admit(original.turn, () =>
    store.saveConfiguration({ catalog, rules }, original.turn),
  );
}
export function createOvitrapLifecycle(deps: Dependencies): LifecycleService {
  const store = new LifecycleStore(deps.db);
  return new LifecycleService({
    store,
    source: createLifecycleSourcePort(deps.bundle, deps.tokens, deps.db),
    engine: deps.engine,
    uuid: randomUUID,
    now: () => new Date(),
    shiftId: async () => captureShiftId(await deps.shiftOpen.read()),
    gps: deps.gps ?? { locate: () => Promise.resolve(null) },
    evidence: deps.evidence ?? { capture: () => Promise.resolve(null) },
    refresh: (turn, operation) => download(deps, store, { turn, operation }),
  });
}
