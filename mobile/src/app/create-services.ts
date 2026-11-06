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

/** Everything the screens share, created once at startup. */
export interface AppServices {
  readonly day: DayService;
  readonly auth: AuthController;
  readonly ovitrapCheck: OvitrapService;
  readonly ovitrapLifecycle: LifecycleService;
  readonly shiftOpen: ShiftOpenService;
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
  const bundle = createDayBundle({ db, tokens: credentials, requests: () => requests });
  const {
    auth,
    credentials: tokens,
    requests,
  } = await createRuntimeAuth({ db, kv, server, credentials, deviceId }, bundle);
  const engine = createEngine({ kv, outbox, server, deviceId, tokens, requests, auth }, bundle);
  const day = createDay(db, bundle);
  const shiftOpen = createShiftOpen({ db, engine, tokens, requests, uuid: randomUUID });
  const captures = createCaptures({ db, engine, requests, tokens, shiftOpen });
  return { ...captures, kv, outbox, engine, tokens, server, deviceId, auth, shiftOpen, day };
}

function createCaptures(deps: Parameters<typeof createOvitrapCheck>[0]) {
  return { ovitrapCheck: createOvitrapCheck(deps), ovitrapLifecycle: createOvitrapLifecycle(deps) };
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
  "kv" | "outbox" | "server" | "deviceId" | "tokens" | "auth"
> & {
  readonly requests: SessionRequests;
};
function createEngine(deps: EngineDependencies, bundle: DayBundleService): SyncEngine {
  const { kv, outbox, server, deviceId, tokens, requests, auth } = deps;
  return new SyncEngine({
    pass: {
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
    schedule: (callback, delayMs) => {
      const handle = setTimeout(callback, delayMs);
      return () => {
        clearTimeout(handle);
      };
    },
    report: logEngineError,
  });
}
