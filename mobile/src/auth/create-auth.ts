import { getRandomBytes } from "expo-crypto";

import type { ApiClient } from "@wolbachia/api-client";

import { createMobileApiClient } from "../api/create-api-client.ts";
import type { ServerSettings } from "../config/server-settings.ts";
import type { KvStore } from "../db/kv-store.ts";
import type { OutboxRepository } from "../outbox/outbox-repository.ts";
import { AuthController } from "./auth-controller.ts";
import { loginOnline, refreshOnline } from "./auth-api.ts";
import { CredentialStore } from "./credential-store.ts";
import { nativeSecrets } from "./native-secrets.ts";
import { SessionRequests } from "./session-requests.ts";

interface CreateAuthDeps {
  readonly kv: KvStore;
  readonly outbox: OutboxRepository;
  readonly server: ServerSettings;
  readonly deviceId: string;
  readonly appVersion: string;
}

/** Native composition only; policy and persistence are independently testable. */
export async function createAuth(deps: CreateAuthDeps) {
  const credentials = new CredentialStore(nativeSecrets);
  await credentials.load();
  const client = () =>
    createMobileApiClient({ baseUrl: deps.server.baseUrl() ?? "", tokens: credentials });
  const anonymous = () => createMobileApiClient({ baseUrl: deps.server.baseUrl() ?? "" });
  const auth: AuthController = new AuthController({
    credentials,
    kv: deps.kv,
    outbox: deps.outbox,
    randomBytes: getRandomBytes,
    now: Date.now,
    login: (username, password) => loginConfigured(deps, anonymous(), { username, password }),
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

function loginConfigured(
  deps: CreateAuthDeps,
  client: ApiClient,
  secret: { username: string; password: string },
) {
  if (deps.server.baseUrl() === null) {
    return Promise.resolve({
      ok: false as const,
      notice: { key: "mobile.login.serverMissing" as const },
    });
  }
  return loginOnline(client, { ...secret, device_id: deps.deviceId, app_version: deps.appVersion });
}

async function fetchAuthRules(client: ApiClient, requests: SessionRequests): Promise<unknown> {
  const result = await requests.run(() =>
    client.GET("/api/v1/field/rules/", {
      signal: AbortSignal.timeout(30_000),
    }),
  );
  return result.data;
}
