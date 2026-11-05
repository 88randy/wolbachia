import { unwrap } from "@wolbachia/api-client";
import { randomUUID } from "expo-crypto";
import { createMobileApiClient } from "../../api/create-api-client.ts";
import type { TokenStore } from "../../auth/token-store.ts";
import type { ServerSettings } from "../../config/server-settings.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import type { ShiftOpenService } from "../shift-open/service.ts";
import { captureShiftId } from "./shift-authorization.ts";
import { OvitrapService } from "./service.ts";
import { readCatalog, readRules } from "./snapshots.ts";
import { OvitrapStore } from "./store.ts";
import type { Assignment, EvidencePort, GpsPort, ScannerPort } from "./types.ts";
interface Dependencies {
  readonly db: SqlExecutor;
  readonly shiftOpen: Pick<ShiftOpenService, "read">;
  readonly engine: SyncEngine;
  readonly server: ServerSettings;
  readonly tokens: TokenStore;
  readonly gps?: GpsPort;
  readonly scanner?: ScannerPort;
  readonly evidence?: EvidencePort;
  readonly assignments?: { read(): Promise<Assignment | null> };
}
async function download(deps: Dependencies, store: OvitrapStore): Promise<void> {
  const baseUrl = deps.server.baseUrl();
  const access = deps.tokens.getAccessToken();
  if (!baseUrl || !access) throw new Error("Snapshots need a server and session.");
  const client = createMobileApiClient({ baseUrl, tokens: deps.tokens });
  const signal = AbortSignal.timeout(30_000);
  const catalog = readCatalog(unwrap(await client.GET("/api/v1/field/catalog/", { signal })));
  const rules = readRules(unwrap(await client.GET("/api/v1/field/rules/", { signal })));
  const previous = await store.snapshots();
  const assignment = deps.assignments ? await deps.assignments.read() : previous.assignment;
  if (access !== deps.tokens.getAccessToken() || baseUrl !== deps.server.baseUrl())
    throw new Error("Snapshot session changed.");
  await store.saveSnapshots({ catalog, rules, assignment });
}
/** No native additions: unsupported scanner/GPS/evidence remain explicit unavailable ports. */
export function createOvitrapCheck(deps: Dependencies): OvitrapService {
  const store = new OvitrapStore(deps.db);
  return new OvitrapService({
    store,
    engine: deps.engine,
    now: () => new Date(),
    uuid: randomUUID,
    gps: deps.gps ?? { locate: () => Promise.resolve(null) },
    scanner: deps.scanner ?? { scan: () => Promise.resolve({ status: "unavailable" }) },
    evidence: deps.evidence ?? { capture: () => Promise.resolve(null) },
    shiftId: async () => captureShiftId(await deps.shiftOpen.read()),
    refresh: () => download(deps, store),
  });
}
