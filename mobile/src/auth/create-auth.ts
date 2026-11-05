import type { ApiClient } from "@wolbachia/api-client";

import { createMobileApiClient } from "../api/create-api-client.ts";
import type { ServerSettings } from "../config/server-settings.ts";
import type { KvStore } from "../db/kv-store.ts";
import { hasLocalRecords } from "../db/owner-data.ts";
import type { SqlExecutor } from "../db/sql.ts";
import { AuthController } from "./auth-controller.ts";
import { loginOnline, refreshOnline } from "./auth-api.ts";
import type { CredentialStore } from "./credential-store.ts";
import { SessionRequests } from "./session-requests.ts";

interface CreateAuthDeps {
  readonly randomBytes: (length: number) => Uint8Array;
  readonly now: () => number;
  readonly fetch?: (request: Request) => Promise<Response>;
  readonly credentials: CredentialStore;
  readonly kv: KvStore;
  readonly db: SqlExecutor;
  readonly server: ServerSettings;
  readonly deviceId: string;
  readonly appVersion: string;
}

/** Auth composition uses injectable native ports and the generated API client. */
export async function createAuth(deps: CreateAuthDeps) {
  const { credentials } = deps;
  const client = () => createSessionClient(deps, true);
  const anonymous = () => createSessionClient(deps, false);
  const auth: AuthController = new AuthController({
    credentials,
    kv: deps.kv,
    hasLocalRecords: () => hasLocalRecords(deps.db),
    randomBytes: deps.randomBytes,
    now: deps.now,
    login: (username, password) => loginConfigured(deps, { username, password }),
    fetchRules: () => fetchAuthRules(client(), requests),
  });
  const requests: SessionRequests = new SessionRequests({
    credentials,
    isOnline: () => auth.getSnapshot().isOnline,
    endSession: () => auth.endSession(),
    refresh: (pair) => refreshOnline(anonymous(), pair, deps.deviceId),
  });
  await auth.load();
  return { auth, credentials, requests };
}

/** Both bearer and refresh-body credentials are routed to their stored issuer. */
function createSessionClient(deps: CreateAuthDeps, isAuthenticated: boolean): ApiClient {
  return createMobileApiClient({
    baseUrl: deps.credentials.getOrigin() ?? "",
    ...(isAuthenticated ? { tokens: deps.credentials } : {}),
    ...(deps.fetch === undefined ? {} : { fetch: deps.fetch }),
  });
}

function loginConfigured(deps: CreateAuthDeps, secret: { username: string; password: string }) {
  const origin = deps.server.baseUrl();
  if (origin === null) {
    return Promise.resolve({
      ok: false as const,
      notice: { key: "mobile.login.serverMissing" as const },
    });
  }
  const client = createMobileApiClient({
    baseUrl: origin,
    ...(deps.fetch === undefined ? {} : { fetch: deps.fetch }),
  });
  return loginOnline(
    client,
    { ...secret, device_id: deps.deviceId, app_version: deps.appVersion },
    origin,
  );
}

async function fetchAuthRules(client: ApiClient, requests: SessionRequests): Promise<unknown> {
  const result = await requests.run(() =>
    client.GET("/api/v1/field/rules/", {
      signal: AbortSignal.timeout(30_000),
    }),
  );
  return result.data;
}
