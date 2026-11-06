import { getRandomBytes, randomUUID } from "expo-crypto";

import { createOvitrapCheck } from "../features/ovitrap-check/create-ovitrap-check.ts";
import type { OvitrapService } from "../features/ovitrap-check/service.ts";
import { createShiftOpen } from "../features/shift-open/create-shift-open.ts";
import type { ShiftOpenService } from "../features/shift-open/service.ts";

import { createMobileApiClient } from "../api/create-api-client.ts";
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
import { createSyncTransport } from "../sync/sync-transport.ts";
import type { SyncTransport } from "../sync/sync-transport.ts";

/** Everything the screens share, created once at startup. */
export interface AppServices {
  readonly auth: AuthController;
  readonly ovitrapCheck: OvitrapService;
  readonly shiftOpen: ShiftOpenService;
  readonly kv: KvStore;
  readonly outbox: OutboxRepository;
  readonly engine: SyncEngine;
  readonly tokens: TokenStore;
  readonly server: ServerSettings;
  readonly deviceId: string;
}

// Initial provisioning selects the identity-bound address before authenticated work begins.
function lazyTransport(tokens: TokenStore, session: SessionRequests): SyncTransport {
  return async (request) => {
    const baseUrl = tokens.getOrigin();
    if (baseUrl === null) return { ok: false, failure: { kind: "network" } };
    return createSyncTransport(createMobileApiClient({ baseUrl, tokens }), session)(request);
  };
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
  const {
    auth,
    credentials: tokens,
    requests,
  } = await createAuth({
    randomBytes: getRandomBytes,
    now: Date.now,
    credentials,
    kv,
    db,
    server,
    deviceId,
    appVersion: appManifest.version,
  });
  const engine = createEngine({ kv, outbox, server, deviceId, tokens, requests });
  const shiftOpen = createShiftOpen({ db, engine, tokens, requests, uuid: randomUUID });
  const ovitrapCheck = createOvitrapCheck({ db, engine, requests, tokens, shiftOpen });
  return { ovitrapCheck, kv, outbox, engine, tokens, server, deviceId, auth, shiftOpen };
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

function createEngine(
  deps: Omit<AppServices, "engine" | "auth" | "shiftOpen" | "ovitrapCheck"> & {
    requests: SessionRequests;
  },
): SyncEngine {
  const { kv, outbox, server, deviceId, tokens, requests } = deps;
  return new SyncEngine({
    pass: {
      outbox,
      kv,
      deviceId,
      now: () => new Date(),
      transport: lazyTransport(tokens, requests),
    },
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
