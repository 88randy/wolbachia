import { createShiftClose } from "../features/shift-close/create-shift-close.ts";
import type { ShiftCloseService } from "../features/shift-close/service.ts";
import { createOvitrapLifecycle } from "../features/ovitrap-lifecycle/create-ovitrap-lifecycle.ts";
import type { LifecycleService } from "../features/ovitrap-lifecycle/service.ts";
import type { SqlExecutor } from "../db/sql.ts";
import { createDay, createDayBundle } from "../features/day/create-day.ts";
import type { DayService } from "../features/day/service.ts";
import type { DayBundleService } from "../features/day/bundle-service.ts";
import { getRandomBytes, randomUUID } from "expo-crypto";

import { createOvitrapCheck } from "../features/ovitrap-check/create-ovitrap-check.ts";
import type { OvitrapService } from "../features/ovitrap-check/service.ts";
import { createShiftOpen } from "../features/shift-open/create-shift-open.ts";
import type { ShiftOpenService } from "../features/shift-open/service.ts";

import { createAuth } from "../auth/create-auth.ts";
import { CredentialStore } from "../auth/credential-store.ts";
import { nativeSecrets } from "../auth/native-secrets.ts";
import { readEndedSession } from "../auth/session-journal.ts";
import type { AuthController } from "../auth/auth-controller.ts";
import type { SessionRequests } from "../auth/session-requests.ts";
import appManifest from "../../package.json";
import type { TokenStore } from "../auth/token-store.ts";
import { BUILD_API_BASE_URL, LAN_HTTP_FLAG, allowsPrivateLanHttp } from "../config/build-config.ts";
import { ServerSettings } from "../config/server-settings.ts";
import { KvStore } from "../db/kv-store.ts";
import { openDatabase } from "../db/open-database.ts";
import { OutboxRepository } from "../outbox/outbox-repository.ts";
import { getOrCreateDeviceId } from "../sync/device-id.ts";
import { SyncEngine } from "../sync/sync-engine.ts";
import { createScopedSyncTransport } from "../sync/scoped-sync-transport.ts";
import { createAttachments } from "../attachments/create-attachments.ts";
import { attachmentSyncHooks } from "../attachments/sync-hooks.ts";
import type { Attachments } from "../attachments/create-attachments.ts";
import { createNativePhotoAcquisition } from "../attachments/native-photo-acquisition.ts";
import { acceptedEvidenceOwner } from "../attachments/accepted-owner.ts";
import { createSupplyReceipt } from "../features/supply-receipt/create-supply-receipt.ts";
import type { SupplyReceiptService } from "../features/supply-receipt/service.ts";
import { createFuel } from "../features/fuel/create-fuel.ts";
import type { FuelService } from "../features/fuel/service.ts";

/** Everything the screens share, created once at startup. */
export interface AppServices {
  readonly attachments: Attachments;
  readonly supplyReceipt: SupplyReceiptService;
  readonly fuel: FuelService;
  readonly day: DayService;
  readonly auth: AuthController;
  readonly ovitrapCheck: OvitrapService;
  readonly ovitrapLifecycle: LifecycleService;
  readonly shiftOpen: ShiftOpenService;
  readonly shiftClose: ShiftCloseService;
  readonly kv: KvStore;
  readonly outbox: OutboxRepository;
  readonly engine: SyncEngine;
  readonly tokens: TokenStore & Pick<CredentialStore, "getSnapshot">;
  readonly server: ServerSettings;
  readonly deviceId: string;
}

function logEngineError(error: unknown): void {
  // Structured, no event content (it can hold personal data).
  console.warn("sync.engine_error", error instanceof Error ? error.name : "unknown");
}

/** Opens the database and wires the services. Throws if the database cannot be opened. */
export async function createServices(): Promise<AppServices> {
  const db = await openDatabase();
  const kv = new KvStore(db);
  const outbox = new OutboxRepository(db, () => new Date());
  const { server, credentials } = await loadIdentity(kv, outbox);
  const deviceId = await getOrCreateDeviceId(kv, randomUUID);
  // Bootstrap cannot run until composition finishes; auth cleanup can use the short projection gate during load.
  let acceptedAuth: AuthController | null = null;
  const bundle = createDayBundle({
    db,
    tokens: credentials,
    requests: () => requests,
    getCaptureIdentity: () => captureIdentity(acceptedAuth, credentials, deviceId),
  });
  const runtime = await createRuntimeAuth({ db, kv, server, credentials, deviceId }, bundle);
  const { auth, credentials: tokens, requests } = runtime;
  acceptedAuth = auth;
  const attachments = createAttachments({ db, auth, tokens, deviceId, requests });
  const shared = { kv, outbox, server, deviceId, tokens, requests, auth, attachments };
  const engine = createEngine(shared, bundle);
  const day = createDay(db, bundle);
  const shiftOpen = createShiftOpen({ db, engine, tokens, requests, uuid: randomUUID });
  const evidence = createNativePhotoAcquisition(() => auth.getSnapshot().phase === "unlocked");
  const captureDeps = { db, engine, requests, tokens, shiftOpen, attachments, evidence, auth };
  const captures = createCaptures(captureDeps, bundle, day);
  const forms = createLocalForms({ ...captureDeps, day, bundle, deviceId });
  return { ...shared, ...captures, engine, shiftOpen, day, ...forms };
}
function captureIdentity(
  auth: AuthController | null,
  credentials: CredentialStore,
  deviceId: string,
) {
  return acceptedEvidenceOwner({
    profile: auth?.getSnapshot().profile ?? null,
    credentials: credentials.getSnapshot(),
    deviceId,
  });
}

function createCaptures(
  deps: Parameters<typeof createOvitrapCheck>[0] & { tokens: CredentialStore },
  bundle: DayBundleService,
  day: DayService,
) {
  return {
    ovitrapCheck: createOvitrapCheck(deps),
    ovitrapLifecycle: createOvitrapLifecycle({
      ...deps,
      bundle,
      location: day.location,
      selectTask: (id, expected, admission) => day.select(id, expected, admission),
    }),
  };
}

function createLocalForms(input: Parameters<typeof createShiftClose>[0]) {
  return {
    shiftClose: createShiftClose(input),
    supplyReceipt: createSupplyReceipt(input),
    fuel: createFuel(input),
  };
}

function createRuntimeAuth(
  deps: Pick<AppServices, "kv" | "server" | "deviceId"> & {
    db: SqlExecutor;
    credentials: CredentialStore;
  },
  bundle: DayBundleService,
) {
  return createAuth({
    ...deps,
    clearSessionData: bundle.clearForAuth,
    randomBytes: getRandomBytes,
    now: Date.now,
    appVersion: appManifest.version,
  });
}

async function loadIdentity(kv: KvStore, outbox: OutboxRepository) {
  const credentials = new CredentialStore(nativeSecrets);
  const server = new ServerSettings(kv, BUILD_API_BASE_URL, {
    credentials,
    outbox,
    allowCleartext: allowsPrivateLanHttp(__DEV__, LAN_HTTP_FLAG),
  });
  await server.load();
  await credentials.load((sessionId) => readEndedSession(kv, sessionId), server.baseUrl());
  return { credentials, server };
}

type EngineDependencies = Pick<
  AppServices,
  "kv" | "outbox" | "server" | "deviceId" | "tokens" | "auth" | "attachments"
> & {
  readonly requests: SessionRequests;
};
function createEngine(deps: EngineDependencies, bundle: DayBundleService): SyncEngine {
  const { kv, outbox, server, deviceId, tokens, requests, auth } = deps;
  return new SyncEngine({
    pass: {
      attachments: attachmentSyncHooks(deps.attachments),
      outbox,
      kv,
      deviceId,
      now: () => new Date(),
      transport: createScopedSyncTransport({ tokens, requests }),
      ...bundle.syncHooks(),
    },
    beforeSync: auth.retrySessionDataCleanup,
    hasSession: () => tokens.hasSyncSession(),
    hasPendingFinalUpload: tokens.hasPendingFinalUpload,
    hasServer: () => (tokens.hasSyncSession() ? tokens.getOrigin() : server.baseUrl()) !== null,
    random: Math.random,
    schedule: scheduleSync,
    report: logEngineError,
  });
}
function scheduleSync(callback: () => void, delayMs: number): () => void {
  const handle = setTimeout(callback, delayMs);
  return () => {
    clearTimeout(handle);
  };
}
