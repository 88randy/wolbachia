import { unwrap } from "@wolbachia/api-client";
import { randomUUID } from "expo-crypto";
import { createMobileApiClient } from "../../api/create-api-client.ts";
import type { TokenStore } from "../../auth/token-store.ts";
import type { CredentialStore, Credentials } from "../../auth/credential-store.ts";
import type { SessionRequests } from "../../auth/session-requests.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import type { ShiftOpenService } from "../shift-open/service.ts";
import { captureShiftId, readCaptureShift } from "./shift-authorization.ts";
import { OvitrapService } from "./service.ts";
import { readCatalog, readRules } from "./snapshots.ts";
import { OvitrapStore } from "./store.ts";
import { publishAssignment } from "./publish-assignment.ts";
import { LabelPoolStore, readLabelPool } from "./label-pool.ts";
import { RemoteSessionEnded } from "../../auth/session-requests.ts";
import type { Assignment, EvidencePort, GpsPort, ScannerPort } from "./types.ts";
import type { Attachments } from "../../attachments/create-attachments.ts";
import { captureConfiguration } from "../../attachments/capture-configuration.ts";
interface Dependencies {
  readonly db: SqlExecutor;
  readonly shiftOpen: Pick<ShiftOpenService, "read" | "readWithGuard">;
  readonly engine: SyncEngine;
  readonly requests: SessionRequests;
  readonly tokens: TokenStore & Pick<CredentialStore, "getSnapshot">;
  readonly gps?: GpsPort;
  readonly scanner?: ScannerPort;
  readonly evidence: EvidencePort;
  readonly attachments?: Attachments;
  readonly assignments?: { read(): Promise<Assignment | null> };
}
async function download(
  deps: Dependencies,
  store: OvitrapStore,
  labels: LabelPoolStore,
): Promise<void> {
  await publishAssignment(deps.assignments, store);
  const baseUrl = deps.tokens.getOrigin();
  const session = deps.tokens.getSnapshot();
  if (baseUrl === null || deps.tokens.getAccessToken() === undefined)
    throw new Error("Snapshots need a server and session.");
  const client = createMobileApiClient({ baseUrl, tokens: deps.tokens });
  const signal = AbortSignal.timeout(30_000);
  const catalog = readCatalog(
    unwrap(await deps.requests.run(() => client.GET("/api/v1/field/catalog/", { signal }))),
  );
  const rules = readRules(
    unwrap(await deps.requests.run(() => client.GET("/api/v1/field/rules/", { signal }))),
  );
  requireSession(deps.tokens, session);
  await store.saveSnapshots({ catalog, rules });
  await downloadLabels(deps, client, labels);
}
/** The pool is a convenience for typed codes: a failed download keeps the previous pool and never blocks the rest. */
async function downloadLabels(
  deps: Dependencies,
  client: ReturnType<typeof createMobileApiClient>,
  labels: LabelPoolStore,
): Promise<void> {
  try {
    const signal = AbortSignal.timeout(30_000);
    const pool = readLabelPool(
      unwrap(
        await deps.requests.run(() => client.GET("/api/v1/field/ovitrap-labels/", { signal })),
      ),
    );
    await labels.save(pool);
  } catch (error) {
    if (error instanceof RemoteSessionEnded) throw error;
  }
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
/** Evidence acquisition is explicit; unsupported scanner/GPS retain their existing unavailable ports. */
export function createOvitrapCheck(deps: Dependencies): OvitrapService {
  const store = new OvitrapStore(deps.db);
  const labels = new LabelPoolStore(deps.db);
  return new OvitrapService({
    store,
    engine: deps.engine,
    now: () => new Date(),
    uuid: randomUUID,
    gps: deps.gps ?? { locate: () => Promise.resolve(null) },
    scanner: deps.scanner ?? { scan: () => Promise.resolve({ status: "unavailable" }) },
    ...captureConfiguration({ port: deps.evidence, store, attachments: deps.attachments }),
    shiftId: async () => captureShiftId(await deps.shiftOpen.read()),
    evidenceShift: () => readCaptureShift(deps.shiftOpen),
    refresh: () => download(deps, store, labels),
    labelPool: () => labels.read(),
    publishAssignment: () => publishAssignment(deps.assignments, store),
  });
}
