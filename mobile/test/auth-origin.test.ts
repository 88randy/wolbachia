import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { it } from "node:test";

import { createMobileApiClient } from "../src/api/create-api-client.ts";
import { createAuth } from "../src/auth/create-auth.ts";
import { CredentialStore } from "../src/auth/credential-store.ts";
import { SessionRequests } from "../src/auth/session-requests.ts";
import { ServerSettings } from "../src/config/server-settings.ts";
import { KV_KEYS } from "../src/db/kv-store.ts";
import { runSyncPass, SYNC_BATCH_SIZE } from "../src/sync/sync-pass.ts";
import { createSyncTransport } from "../src/sync/sync-transport.ts";
import { deferred, loginResponse, memorySecrets, makeCredentials } from "./support/auth-fakes.ts";
import { createStores, FIXED_DEVICE_ID, FIXED_NOW } from "./support/factories.ts";
import { answer } from "./support/scripted-transport.ts";

const ORIGIN_A = "https://issuer.example.invalid";
const ORIGIN_B = "https://substitute.example.invalid";
function jsonResponse(body: unknown, status = 200, revoked = false): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(revoked ? { "X-Session-Revoked": "true" } : {}),
    },
  });
}

void it("refuses server changes during login and pins rules, refresh, sync and final upload to the captured issuer even after forced substitution", async () => {
  const stores = await createStores();
  const credentials = new CredentialStore(memorySecrets());
  const server = new ServerSettings(stores.kv, ORIGIN_A, { credentials, outbox: stores.outbox });
  const entered = deferred<undefined>();
  const reply = deferred<Response>();
  const rulesEntered = deferred<undefined>();
  const sent: Request[] = [];
  let rulesCalls = 0;
  const fetch = (request: Request) => {
    sent.push(request);
    const path = new URL(request.url).pathname;
    if (path.endsWith("/login/")) {
      entered.resolve(undefined);
      return reply.promise;
    }
    if (path.endsWith("/rules/")) {
      rulesCalls += 1;
      rulesEntered.resolve(undefined);
      return Promise.resolve(
        rulesCalls === 2
          ? jsonResponse({ code: "token_expired", detail: "" }, 401)
          : jsonResponse(null),
      );
    }
    if (path.endsWith("/refresh/"))
      return Promise.resolve(
        jsonResponse({
          access: randomUUID(),
          refresh: randomUUID(),
          server_time: FIXED_NOW.toISOString(),
        }),
      );
    const result = answer([]);
    assert.ok(result.ok);
    return Promise.resolve(
      jsonResponse(result.response, 200, credentials.getSnapshot().status === "ended"),
    );
  };
  const { auth, requests } = await createAuth({
    ...stores,
    credentials,
    server,
    deviceId: FIXED_DEVICE_ID,
    appVersion: "test",
    randomBytes,
    now: () => FIXED_NOW.getTime(),
    fetch,
  });
  auth.setOnline(true);
  const loggingIn = auth.login("courier-test", randomUUID());
  await entered.promise;
  const change = await server.save(ORIGIN_B);
  const reset = await server.clear();
  // Simulate external tampering. Routing must remain safe even if the guard is bypassed.
  await stores.kv.set(KV_KEYS.apiBaseUrlOverride, ORIGIN_B);
  await server.load();
  reply.resolve(jsonResponse(loginResponse()));
  await loggingIn;
  await rulesEntered.promise;
  const origin = credentials.getSnapshot().origin;
  const client = createMobileApiClient({ baseUrl: ORIGIN_B, tokens: credentials, fetch });
  await requests.run(() => client.GET("/api/v1/field/rules/"));
  const deps = {
    ...stores,
    deviceId: FIXED_DEVICE_ID,
    now: () => FIXED_NOW,
    transport: createSyncTransport(client, requests),
  };
  await runSyncPass(deps, { batchSize: SYNC_BATCH_SIZE });
  await auth.endSession();
  await runSyncPass(deps, { batchSize: SYNC_BATCH_SIZE });
  assert.deepEqual(change, { ok: false, problem: "identityBound" });
  assert.deepEqual(reset, { ok: false, problem: "identityBound" });
  assert.equal(origin, ORIGIN_A);
  assert.ok(sent.some((request) => request.url.endsWith("/refresh/")));
  assert.equal(sent.filter((request) => request.url.endsWith("/sync/")).length, 2);
  assert.ok(sent.every((request) => new URL(request.url).origin === ORIGIN_A));
  assert.equal(credentials.getSnapshot().pair, null);
});

void it("a stale sync client cannot send a replacement origin's explicit bearer to its old target", async () => {
  const h = await makeCredentials();
  await h.credentials.update((current) => ({ ...current, origin: ORIGIN_A }));
  let posts = 0;
  const client = createMobileApiClient({
    baseUrl: ORIGIN_A,
    tokens: h.credentials,
    fetch: () => {
      posts += 1;
      const result = answer([]);
      assert.ok(result.ok);
      return Promise.resolve(jsonResponse(result.response));
    },
  });
  await h.credentials.update((current) => ({
    ...current,
    origin: ORIGIN_B,
    pair: { access: randomUUID(), refresh: randomUUID() },
  }));
  const session = new SessionRequests({
    credentials: h.credentials,
    isOnline: () => true,
    endSession: () => h.credentials.markEnded(h.credentials.getSnapshot().sessionId),
    refresh: () => {
      throw new Error("No refresh for an origin mismatch.");
    },
  });
  const result = await createSyncTransport(
    client,
    session,
  )({ device_id: FIXED_DEVICE_ID, sent_at: FIXED_NOW.toISOString(), events: [] });
  assert.equal(result.ok, false);
  assert.equal(posts, 0);
  assert.equal(h.credentials.getOrigin(), ORIGIN_B);
  assert.equal(h.credentials.hasSyncSession(), true);
});
