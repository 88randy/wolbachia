import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { it } from "node:test";

import { createMobileApiClient } from "../src/api/create-api-client.ts";
import { AuthController } from "../src/auth/auth-controller.ts";
import { CredentialStore } from "../src/auth/credential-store.ts";
import { SessionRequests } from "../src/auth/session-requests.ts";
import { observeConnectivity } from "../src/sync/connectivity.ts";
import { observeSyncSession } from "../src/sync/observe-sync-session.ts";
import { SyncEngine } from "../src/sync/sync-engine.ts";
import { createSyncTransport } from "../src/sync/sync-transport.ts";
import { deferred, makeCredentials } from "./support/auth-fakes.ts";
import { createStores, FIXED_DEVICE_ID, FIXED_NOW, makeEnvelope } from "./support/factories.ts";
import { accepted, answer } from "./support/scripted-transport.ts";

type Reading = { isConnected: boolean | null; isInternetReachable?: boolean | null };

void it("maps connected LAN without Internet to online for auth and sync, publishing auth first; unknown/disconnected stays offline", () => {
  let emit: (reading: Reading) => void = () => {
    throw new Error("Not subscribed.");
  };
  let isAuthOnline = false;
  const authReadings: boolean[] = [];
  const engineReadings: boolean[] = [];
  const stop = observeConnectivity(
    (listener) => {
      emit = listener;
      return () => undefined;
    },
    {
      auth: {
        setOnline: (online) => {
          isAuthOnline = online;
          authReadings.push(online);
        },
      },
      engine: {
        setOnline: (online) => {
          assert.equal(isAuthOnline, online);
          engineReadings.push(online);
        },
      },
    },
  );
  emit({ isConnected: true, isInternetReachable: false });
  emit({ isConnected: null, isInternetReachable: true });
  emit({ isConnected: false, isInternetReachable: true });
  assert.deepEqual(authReadings, [false, true, false, false]);
  assert.deepEqual(engineReadings, authReadings);
  stop();
});

void it("a restarted ended session waits offline, then connectivity alone sends exactly one final POST, including a disconnect inside a pass", async () => {
  for (const timing of ["beforeCallback", "duringPass"]) {
    const stores = await createStores();
    const h = await makeCredentials();
    await h.credentials.markEnded(h.credentials.getSnapshot().sessionId);
    const credentials = new CredentialStore(h.secrets);
    await credentials.load();
    const auth = new AuthController({
      ...stores,
      credentials,
      randomBytes,
      now: () => FIXED_NOW.getTime(),
      login: () => {
        throw new Error("No login during final upload.");
      },
      fetchRules: () => Promise.resolve(null),
    });
    await auth.load();
    const event = makeEnvelope();
    await stores.outbox.enqueue(event);
    await stores.kv.set("test_draft", "half-filled form");
    let posts = 0;
    const session = new SessionRequests({
      credentials,
      isOnline: () => auth.getSnapshot().isOnline,
      endSession: () => auth.endSession(),
      refresh: () => {
        throw new Error("An ended pair never refreshes.");
      },
    });
    const client = createMobileApiClient({
      baseUrl: credentials.getOrigin() ?? "",
      tokens: credentials,
      fetch: (request) => {
        posts += 1;
        assert.equal(auth.getSnapshot().isOnline, true);
        assert.equal(
          request.headers.get("Authorization"),
          `Bearer ${String(credentials.getSnapshot().pair?.access)}`,
        );
        const result = answer([accepted(event.id)]);
        assert.ok(result.ok);
        return Promise.resolve(
          new Response(JSON.stringify(result.response), {
            status: 200,
            headers: { "Content-Type": "application/json", "X-Session-Revoked": "true" },
          }),
        );
      },
    });
    let retryCount = 0;
    let retry: () => void = () => {
      throw new Error("No retry scheduled.");
    };
    const engine = new SyncEngine({
      pass: {
        ...stores,
        deviceId: FIXED_DEVICE_ID,
        now: () => FIXED_NOW,
        transport: createSyncTransport(client, session),
      },
      hasSession: credentials.hasSyncSession,
      hasPendingFinalUpload: credentials.hasPendingFinalUpload,
      hasServer: () => true,
      random: () => 0,
      schedule: (callback) => {
        retry = callback;
        retryCount += 1;
        return () => undefined;
      },
      report: (error) => {
        throw error;
      },
    });
    let emit: (reading: Reading) => void = () => {
      throw new Error("Not subscribed.");
    };
    const stopNet = observeConnectivity(
      (listener) => {
        emit = listener;
        return () => undefined;
      },
      { auth, engine },
    );
    const stopTokens = observeSyncSession(engine, credentials);
    const paused = deferred<undefined>();
    const finished = deferred<undefined>();
    let hasDisconnected = false;
    const stopEngine = engine.subscribe(() => {
      const phase = engine.getSnapshot().phase;
      if (timing === "duringPass" && !hasDisconnected && phase === "syncing") {
        hasDisconnected = true;
        emit({ isConnected: false });
      }
      if (hasDisconnected && (phase === "waitingRetry" || phase === "blocked"))
        paused.resolve(undefined);
      if (phase === "blocked" && !credentials.hasSyncSession()) finished.resolve(undefined);
    });
    await engine.start();
    assert.equal(posts, 0);
    assert.equal(engine.getSnapshot().blockReason, null);
    assert.notEqual(credentials.getSnapshot().pair, null);
    emit({ isConnected: true, isInternetReachable: true });
    if (timing === "duringPass") {
      await paused.promise;
      assert.equal(engine.getSnapshot().phase, "waitingRetry");
      assert.equal(engine.getSnapshot().lastFailureCode, "network");
      assert.equal(retryCount, 1);
      assert.equal(posts, 0);
      assert.notEqual(credentials.getSnapshot().pair, null);
      emit({ isConnected: true });
      assert.equal(posts, 0, "Connectivity hints honor an already scheduled retry deadline.");
      retry();
    }
    await finished.promise;
    stopNet();
    stopTokens();
    stopEngine();
    assert.equal(posts, 1);
    assert.equal(credentials.getSnapshot().pair, null);
    assert.equal((await stores.outbox.countByStatus()).sent, 1);
    assert.equal(await stores.kv.get("test_draft"), "half-filled form");
  }
});
