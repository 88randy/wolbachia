import { unwrap } from "@wolbachia/api-client";
import { randomUUID } from "expo-crypto";
import { createMobileApiClient } from "../../api/create-api-client.ts";
import type { TokenStore } from "../../auth/token-store.ts";
import type { CredentialStore, Credentials } from "../../auth/credential-store.ts";
import type { SessionRequests } from "../../auth/session-requests.ts";
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
  readonly requests: SessionRequests;
  readonly tokens: TokenStore & Pick<CredentialStore, "getSnapshot">;
  readonly gps?: GpsPort;
  readonly scanner?: ScannerPort;
  readonly evidence?: EvidencePort;
  readonly assignments?: { read(): Promise<Assignment | null> };
}
async function download(deps: Dependencies, store: OvitrapStore): Promise<void> {
  const baseUrl = deps.tokens.getOrigin();
  const session = deps.tokens.getSnapshot();
  if (baseUrl === null || deps.tokens.getAccessToken() === undefined)
    throw new Error("Snapshots need a server and session.");
  const authority = deps.assignments ? await store.assignmentAuthority() : null;
  const client = createMobileApiClient({ baseUrl, tokens: deps.tokens });
  const signal = AbortSignal.timeout(30_000);
  const catalog = readCatalog(
    unwrap(await deps.requests.run(() => client.GET("/api/v1/field/catalog/", { signal }))),
  );
  const rules = readRules(
    unwrap(await deps.requests.run(() => client.GET("/api/v1/field/rules/", { signal }))),
  );
  const assignment = deps.assignments ? await deps.assignments.read() : null;
  requireSession(deps.tokens, session);
  if (authority !== null) return store.publishSnapshots({ catalog, rules, assignment }, authority);
  await store.saveSnapshots({ catalog, rules });
}
function requireSession(tokens: Dependencies["tokens"], session: Credentials): void {
  const current = tokens.getSnapshot();
  if (
    current.status !== "active" ||
    current.sessionId !== session.sessionId ||
    current.origin !== session.origin
  )
    throw new Error("Snapshot session changed.");
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
