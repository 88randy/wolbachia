import { createOvitrapCheck } from "../features/ovitrap-check/create-ovitrap-check.ts";
import type { OvitrapService } from "../features/ovitrap-check/service.ts";
import { createShiftOpen } from "../features/shift-open/create-shift-open.ts";
import type { ShiftOpenService } from "../features/shift-open/service.ts";
import { randomUUID } from "expo-crypto";

import { createMobileApiClient } from "../api/create-api-client.ts";
import { createMemoryTokenStore } from "../auth/token-store.ts";
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
  readonly ovitrapCheck: OvitrapService;
  readonly shiftOpen: ShiftOpenService;
  readonly kv: KvStore;
  readonly outbox: OutboxRepository;
  readonly engine: SyncEngine;
  readonly tokens: TokenStore;
  readonly server: ServerSettings;
  readonly deviceId: string;
}

// The address can change in Settings, so the client is built per request (cheap) from the current one.
function lazyTransport(server: ServerSettings, tokens: TokenStore): SyncTransport {
  return async (request) => {
    const baseUrl = server.baseUrl();
    if (baseUrl === null) return { ok: false, failure: { kind: "network" } };
    return createSyncTransport(createMobileApiClient({ baseUrl, tokens }))(request);
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
  const server = new ServerSettings(
    kv,
    BUILD_API_BASE_URL,
    allowsPrivateLanHttp(__DEV__, LAN_HTTP_FLAG),
  );
  await server.load();
  const tokens = createMemoryTokenStore();
  const deviceId = await getOrCreateDeviceId(kv, randomUUID);
  const outbox = new OutboxRepository(db, () => new Date());
  const engine = new SyncEngine({
    pass: { outbox, kv, deviceId, now: () => new Date(), transport: lazyTransport(server, tokens) },
    hasSession: () => tokens.getAccessToken() !== undefined,
    hasServer: () => server.baseUrl() !== null,
    random: Math.random,
    schedule: (callback, delayMs) => {
      const handle = setTimeout(callback, delayMs);
      return () => {
        clearTimeout(handle);
      };
    },
    report: logEngineError,
  });
  const shiftOpen = createShiftOpen({ db, engine, server, tokens });
  const ovitrapCheck = createOvitrapCheck({ db, engine, server, tokens, shiftOpen });
  return { ovitrapCheck, kv, outbox, engine, tokens, server, deviceId, shiftOpen };
}
