import type { DayBundleService } from "../features/day/bundle-service.ts";
import { createDay, createDayBundle } from "../features/day/create-day.ts";
import type { DayService } from "../features/day/service.ts";
import { createShiftOpen } from "../features/shift-open/create-shift-open.ts";
import type { ShiftOpenService } from "../features/shift-open/service.ts";
import { randomUUID } from "expo-crypto";

import { createMemoryTokenStore } from "../auth/token-store.ts";
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
  readonly shiftOpen: ShiftOpenService;
  readonly kv: KvStore;
  readonly outbox: OutboxRepository;
  readonly engine: SyncEngine;
  readonly tokens: TokenStore;
  readonly server: ServerSettings;
  readonly deviceId: string;
}

function logEngineError(error: unknown): void {
  // Structured, no event content (it can hold personal data).
  console.warn("sync.engine_error", error instanceof Error ? error.name : "unknown");
}

function createEngine(
  context: Pick<AppServices, "outbox" | "kv" | "deviceId" | "server" | "tokens">,
  bundle: DayBundleService,
): SyncEngine {
  const { outbox, kv, deviceId, server, tokens } = context;
  return new SyncEngine({
    pass: {
      outbox,
      kv,
      deviceId,
      now: () => new Date(),
      transport: createScopedSyncTransport({ baseUrl: () => server.baseUrl(), tokens }),
      ...bundle.syncHooks(),
    },
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
  const bundle = createDayBundle({ db, server, tokens });
  const day = createDay(db, bundle);
  const engine = createEngine({ outbox, kv, deviceId, server, tokens }, bundle);
  const shiftOpen = createShiftOpen({ db, engine, server, tokens });
  return { kv, outbox, engine, tokens, server, deviceId, shiftOpen, day };
}
