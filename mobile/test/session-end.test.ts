import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { it } from "node:test";

import { loginNotice } from "../src/screens/auth/auth-notice-presentation.ts";
import { createMobileApiClient } from "../src/api/create-api-client.ts";
import { AuthController } from "../src/auth/auth-controller.ts";
import { CredentialStore } from "../src/auth/credential-store.ts";
import { RemoteSessionEnded, SessionRequests } from "../src/auth/session-requests.ts";
import { OutboxRepository } from "../src/outbox/outbox-repository.ts";
import { observeSyncSession } from "../src/sync/observe-sync-session.ts";
import { SyncEngine } from "../src/sync/sync-engine.ts";
import { runSyncPass, SYNC_BATCH_SIZE } from "../src/sync/sync-pass.ts";
import { createSyncTransport } from "../src/sync/sync-transport.ts";
import { deferred, makeCredentials } from "./support/auth-fakes.ts";
import { createStores, makeEnvelope, FIXED_DEVICE_ID, FIXED_NOW } from "./support/factories.ts";
import { accepted, answer } from "./support/scripted-transport.ts";
import type { SqlExecutor } from "../src/db/sql.ts";

function jsonResponse(body: unknown, status = 200, revoked = false): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(revoked ? { "X-Session-Revoked": "true" } : {}),
    },
  });
}

function controller(
  stores: Awaited<ReturnType<typeof createStores>>,
  credentials: CredentialStore,
) {
  return new AuthController({
    ...stores,
    credentials,
    randomBytes,
    now: () => FIXED_NOW.getTime(),
    login: () => {
      throw new Error("No online login in a session-end test.");
    },
    fetchRules: () => Promise.resolve(null),
  });
}

async function harness() {
  const stores = await createStores();
  const secrets = await makeCredentials();
  const auth = controller(stores, secrets.credentials);
  await auth.load();
  await stores.kv.set("test_draft", "half-filled form");
  const event = makeEnvelope();
  await stores.outbox.enqueue(event);
  return { ...stores, ...secrets, auth, event };
}

void it("refresh revoke retries sync with the expired access and commits results before cleanup", async () => {
  const h = await harness();
  const originalAccess = h.credentials.getAccessToken();
  const refreshEntered = deferred<undefined>();
  const refreshed = deferred<never>();
  const finalEntered = deferred<undefined>();
  const finalResponse = deferred<Response>();
  const sent: Request[] = [];
  let refreshes = 0;
  const session = new SessionRequests({
    credentials: h.credentials,
    isOnline: () => true,
    endSession: () => h.auth.endSession(),
    refresh: () => {
      refreshes += 1;
      refreshEntered.resolve(undefined);
      return refreshed.promise;
    },
  });
  const client = createMobileApiClient({
    baseUrl: "https://example.invalid",
    tokens: h.credentials,
    fetch: (request) => {
      sent.push(request);
      if (sent.length === 1)
        return Promise.resolve(jsonResponse({ code: "token_expired", detail: "" }, 401));
      finalEntered.resolve(undefined);
      return finalResponse.promise;
    },
  });
  const running = runSyncPass(
    {
      ...h,
      deviceId: FIXED_DEVICE_ID,
      now: () => FIXED_NOW,
      transport: createSyncTransport(client, session),
    },
    { batchSize: SYNC_BATCH_SIZE },
  );
  await refreshEntered.promise;
  refreshed.reject(new RemoteSessionEnded());
  await Promise.race([
    finalEntered.promise,
    running.then(() => {
      throw new Error("The pass ended before its authorized final POST.");
    }),
  ]);
  assert.equal(h.auth.getSnapshot().phase, "login");
  assert.equal(h.auth.getSnapshot().notice?.key, "mobile.login.sessionEnded");
  assert.notEqual(h.credentials.getSnapshot().pair, null);
  assert.equal(h.auth.canLogin(), false);
  h.auth.setOnline(true);
  await h.auth.login("courier-test", randomUUID());
  assert.equal(h.credentials.getAccessToken(), undefined);
  assert.equal(sent.length, 2);
  assert.equal(refreshes, 1);
  assert.ok(
    sent.every(
      (request) => request.headers.get("Authorization") === `Bearer ${String(originalAccess)}`,
    ),
  );
  const result = answer([
    { id: h.event.id, status: "in_review", code: "final_upload_after_revoke", params: {} },
  ]);
  assert.ok(result.ok);
  finalResponse.resolve(
    jsonResponse({ ...result.response, changes: { ...result.response.changes, has_more: true } }),
  );
  await running;
  assert.equal((await h.outbox.countByStatus()).in_review, 1);
  assert.equal(h.credentials.getSnapshot().pair, null);
  assert.equal(h.credentials.getSnapshot().pin, null);
  assert.equal(h.credentials.getSnapshot().password, null);
  assert.equal(h.auth.canLogin(), true);
  assert.equal(sent.length, 2);
  assert.equal(await h.kv.get("test_draft"), "half-filled form");
});

void it("the revoked response header closes local unlock immediately and defers cleanup until results persist", async () => {
  const h = await harness();
  const commitEntered = deferred<undefined>();
  const commit = deferred<undefined>();
  const db: SqlExecutor = {
    ...h.db,
    runAtomically: async (statements) => {
      if (statements.some((statement) => statement.params?.[0] === "sent")) {
        commitEntered.resolve(undefined);
        await commit.promise;
      }
      await h.db.runAtomically(statements);
    },
  };
  const outbox = new OutboxRepository(db, () => FIXED_NOW);
  let posts = 0;
  const session = new SessionRequests({
    credentials: h.credentials,
    isOnline: () => true,
    endSession: () => h.auth.endSession(),
    refresh: () => {
      throw new Error("A confirmed final upload must never refresh.");
    },
  });
  const result = answer([accepted(h.event.id)]);
  assert.ok(result.ok);
  const client = createMobileApiClient({
    baseUrl: "https://example.invalid",
    tokens: h.credentials,
    fetch: () => {
      posts += 1;
      return Promise.resolve(jsonResponse(result.response, 200, true));
    },
  });
  const running = runSyncPass(
    {
      ...h,
      outbox,
      deviceId: FIXED_DEVICE_ID,
      now: () => FIXED_NOW,
      transport: createSyncTransport(client, session),
    },
    { batchSize: SYNC_BATCH_SIZE },
  );
  await commitEntered.promise;
  assert.equal((await h.outbox.countByStatus()).sent, 0);
  assert.notEqual(h.credentials.getSnapshot().pair, null);
  await h.auth.unlock(h.pinSecret, "pin");
  await h.auth.unlock(h.passwordSecret, "password");
  assert.equal(h.auth.getSnapshot().phase, "login");
  assert.equal(h.auth.canUseBiometrics(), false);
  commit.resolve(undefined);
  await running;
  assert.equal((await h.outbox.countByStatus()).sent, 1);
  assert.equal(h.credentials.getSnapshot().pair, null);
  assert.equal(posts, 1);
  const restarted = new CredentialStore(h.secrets);
  await restarted.load();
  const auth = controller(h, restarted);
  await auth.load();
  await auth.unlock(h.passwordSecret, "password");
  await auth.unlock(h.pinSecret, "pin");
  assert.equal(auth.getSnapshot().phase, "login");
  assert.equal(auth.getSnapshot().notice?.key, "mobile.login.sessionEnded");
  assert.equal(await h.kv.get("test_draft"), "half-filled form");
});

void it("a restart after persisted session end cannot unlock or refresh; only a final sync may use the retained pair", async () => {
  const h = await harness();
  await h.auth.endSession();
  assert.notEqual(h.credentials.getSnapshot().pair, null);
  const restarted = new CredentialStore(h.secrets);
  await restarted.load();
  const auth = controller(h, restarted);
  await auth.load();
  await auth.unlock(h.pinSecret, "pin");
  await auth.unlock(h.passwordSecret, "password");
  auth.unlockBiometric(auth.biometricGate());
  assert.equal(auth.getSnapshot().phase, "login");
  assert.equal(auth.canUseBiometrics(), false);
  assert.equal(loginNotice(auth.getSnapshot(), null)?.key, "mobile.login.sessionEnded");
  assert.notEqual(restarted.getSnapshot().pair, null);
  const session = new SessionRequests({
    credentials: restarted,
    isOnline: () => true,
    endSession: () => auth.endSession(),
    refresh: () => {
      throw new Error("Ended pairs never refresh.");
    },
  });
  await assert.rejects(
    session.run(() => {
      throw new Error("Ended sessions cannot make ordinary requests.");
    }),
    RemoteSessionEnded,
  );
  const result = answer([accepted(h.event.id)]);
  assert.ok(result.ok);
  let posts = 0;
  const client = createMobileApiClient({
    baseUrl: "https://example.invalid",
    tokens: restarted,
    fetch: () => {
      posts += 1;
      return Promise.resolve(jsonResponse(result.response));
    },
  });
  const engine = new SyncEngine({
    pass: {
      ...h,
      deviceId: FIXED_DEVICE_ID,
      now: () => FIXED_NOW,
      transport: createSyncTransport(client, session),
    },
    hasSession: () => restarted.hasSyncSession(),
    hasServer: () => true,
    random: () => 0,
    schedule: () => {
      throw new Error("A definitive final upload cannot schedule another attempt.");
    },
    report: (error) => {
      throw error;
    },
  });
  engine.setOnline(false);
  await engine.start();
  assert.equal(posts, 0);
  assert.notEqual(restarted.getSnapshot().pair, null);
  engine.setOnline(true);
  await engine.requestSync();
  assert.equal(posts, 1);
  assert.equal(restarted.getSnapshot().pair, null);
  assert.equal((await h.outbox.countByStatus()).sent, 1);
});

void it("network failure or timeout keeps the ended pair; normal backoff retries the same access and a final 401 erases it", async () => {
  for (const failure of [
    new TypeError("No signal"),
    new DOMException("Request timed out", "TimeoutError"),
  ]) {
    const h = await harness();
    const access = h.credentials.getSnapshot().pair?.access;
    const entered = deferred<undefined>();
    const response = deferred<Response>();
    const sent: Request[] = [];
    let refreshes = 0;
    const timers: { callback: () => void; delay: number }[] = [];
    const session = new SessionRequests({
      credentials: h.credentials,
      isOnline: () => true,
      endSession: () => h.auth.endSession(),
      refresh: () => {
        refreshes += 1;
        return Promise.reject(new RemoteSessionEnded());
      },
    });
    const client = createMobileApiClient({
      baseUrl: "https://example.invalid",
      tokens: h.credentials,
      fetch: (request) => {
        sent.push(request);
        if (sent.length === 1)
          return Promise.resolve(jsonResponse({ code: "token_expired", detail: "" }, 401));
        if (sent.length === 2) {
          entered.resolve(undefined);
          return response.promise;
        }
        return Promise.resolve(jsonResponse({ code: "token_expired", detail: "" }, 401));
      },
    });
    const engine = new SyncEngine({
      pass: {
        ...h,
        deviceId: FIXED_DEVICE_ID,
        now: () => FIXED_NOW,
        transport: createSyncTransport(client, session),
      },
      hasSession: () => h.credentials.hasSyncSession(),
      hasServer: () => true,
      random: () => 0,
      schedule: (callback, delay) => {
        timers.push({ callback, delay });
        return () => undefined;
      },
      report: (error) => {
        throw error;
      },
    });
    const stop = observeSyncSession(engine, h.credentials);
    const firstPass = engine.start();
    await entered.promise;
    response.reject(failure);
    await firstPass;
    assert.equal(engine.getSnapshot().phase, "waitingRetry");
    assert.equal(timers.length, 1);
    assert.equal(timers[0]?.delay, 1000);
    assert.equal(sent.length, 2);
    assert.equal(h.credentials.getSnapshot().pair?.access, access);
    assert.equal(h.credentials.getSnapshot().status, "ended");
    assert.equal((await h.outbox.countByStatus()).pending, 1);
    timers[0].callback();
    await engine.requestSync();
    stop();
    assert.equal(sent.length, 3);
    assert.equal(refreshes, 1);
    const firstBody: unknown = await sent[1]?.clone().json();
    const retriedBody: unknown = await sent[2]?.clone().json();
    assert.deepEqual(retriedBody, firstBody);
    assert.ok(
      sent.every((request) => request.headers.get("Authorization") === `Bearer ${String(access)}`),
    );
    assert.equal(h.credentials.getSnapshot().pair, null);
    assert.equal((await h.outbox.countByStatus()).pending, 1);
    assert.equal(await h.kv.get("test_draft"), "half-filled form");
  }
});

void it("retryable 5xx, 429, 400 and 413 responses preserve the ended pair and follow the sync failure table", async () => {
  for (const status of [500, 429, 400, 413]) {
    const h = await harness();
    await h.auth.endSession();
    const pair = h.credentials.getSnapshot().pair;
    const session = new SessionRequests({
      credentials: h.credentials,
      isOnline: () => true,
      endSession: () => h.auth.endSession(),
      refresh: () => {
        throw new Error("An ended session never refreshes.");
      },
    });
    const code = (
      {
        500: "server_error",
        429: "throttled",
        400: "validation_error",
        413: "payload_too_large",
      } as const
    )[status];
    const client = createMobileApiClient({
      baseUrl: "https://example.invalid",
      tokens: h.credentials,
      fetch: () =>
        Promise.resolve(
          new Response(JSON.stringify({ code, detail: "" }), {
            status,
            headers: { "Content-Type": "application/json", "Retry-After": "7" },
          }),
        ),
    });
    const result = await runSyncPass(
      {
        ...h,
        deviceId: FIXED_DEVICE_ID,
        now: () => FIXED_NOW,
        transport: createSyncTransport(client, session),
      },
      { batchSize: SYNC_BATCH_SIZE },
    );
    assert.equal(h.credentials.getSnapshot().pair, pair);
    assert.equal(h.credentials.getSnapshot().status, "ended");
    assert.equal(h.credentials.getAccessToken(), undefined);
    if (status === 429)
      assert.deepEqual(result, {
        kind: "retry",
        delayMs: 7000,
        countsAsFailure: false,
        code: "throttled",
      });
    else assert.equal(result.kind, status === 500 ? "retry" : "idle");
    const counts = await h.outbox.countByStatus();
    assert.equal(counts.pending + counts.error, 1);
    assert.equal(await h.kv.get("test_draft"), "half-filled form");
  }
});

void it("a definitive final 401/403 erases the pair without deleting unsent work", async () => {
  for (const status of [401, 403]) {
    const h = await harness();
    await h.auth.endSession();
    const session = new SessionRequests({
      credentials: h.credentials,
      isOnline: () => true,
      endSession: () => h.auth.endSession(),
      refresh: () => {
        throw new Error("An ended session never refreshes.");
      },
    });
    const client = createMobileApiClient({
      baseUrl: "https://example.invalid",
      tokens: h.credentials,
      fetch: () =>
        Promise.resolve(
          jsonResponse(
            {
              code: status === 401 ? "token_expired" : "device_revoked",
              detail: "",
            },
            status,
          ),
        ),
    });
    await runSyncPass(
      {
        ...h,
        deviceId: FIXED_DEVICE_ID,
        now: () => FIXED_NOW,
        transport: createSyncTransport(client, session),
      },
      { batchSize: SYNC_BATCH_SIZE },
    );
    assert.equal(h.credentials.getSnapshot().pair, null);
    assert.equal((await h.outbox.countByStatus()).pending, 1);
    assert.equal(await h.kv.get("test_draft"), "half-filled form");
  }
});

void it("an ended session with no configured server keeps its pair and waits without a POST", async () => {
  const h = await harness();
  await h.auth.endSession();
  const engine = new SyncEngine({
    pass: {
      ...h,
      deviceId: FIXED_DEVICE_ID,
      now: () => FIXED_NOW,
      transport: () => {
        throw new Error("No final POST is possible without a server.");
      },
    },
    hasSession: () => h.credentials.hasSyncSession(),
    hasServer: () => false,
    random: () => 0,
    schedule: () => {
      throw new Error("A missing server blocks the worker.");
    },
    report: (error) => {
      throw error;
    },
  });
  const stop = h.credentials.subscribe(() => {
    engine.notifyConditionsChanged();
  });
  await engine.start();
  stop();
  assert.notEqual(h.credentials.getSnapshot().pair, null);
  assert.equal(engine.getSnapshot().blockReason, "noServer");
  assert.equal((await h.outbox.countByStatus()).pending, 1);
});

void it("the ended journal survives a crash before secure replacement without losing the retry pair", async () => {
  const h = await harness();
  const pair = h.credentials.getSnapshot().pair;
  await h.kv.set(
    "session_ended",
    JSON.stringify({
      sessionId: h.credentials.getSnapshot().sessionId,
      status: "ended",
    }),
  );
  const restarted = new CredentialStore(h.secrets);
  await restarted.load();
  const auth = controller(h, restarted);
  await auth.load();
  await auth.unlock(h.pinSecret, "pin");
  await auth.unlock(h.passwordSecret, "password");
  assert.equal(auth.getSnapshot().phase, "login");
  assert.equal(auth.canUseBiometrics(), false);
  assert.equal(restarted.getAccessToken(), undefined);
  assert.deepEqual(restarted.getSnapshot().pair, pair);
  assert.equal((await h.outbox.countByStatus()).pending, 1);
});
