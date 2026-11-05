import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { it } from "node:test";
import type { Schemas } from "@wolbachia/api-client";

import { createMobileApiClient } from "../src/api/create-api-client.ts";
import { AuthController } from "../src/auth/auth-controller.ts";
import { CredentialStore } from "../src/auth/credential-store.ts";
import { SessionRequests } from "../src/auth/session-requests.ts";
import { observeSyncSession } from "../src/sync/observe-sync-session.ts";
import { SyncEngine } from "../src/sync/sync-engine.ts";
import { runSyncPass, SYNC_BATCH_SIZE } from "../src/sync/sync-pass.ts";
import { createSyncTransport } from "../src/sync/sync-transport.ts";
import { deferred, makeCredentials } from "./support/auth-fakes.ts";
import { createStores, FIXED_DEVICE_ID, FIXED_NOW, makeEnvelope } from "./support/factories.ts";
import { accepted, answer } from "./support/scripted-transport.ts";

function loginReply(): Schemas["MobileLoginResponse"] {
  return {
    access: randomUUID(),
    refresh: randomUUID(),
    server_time: FIXED_NOW.toISOString(),
    me: {
      user: {
        id: randomUUID(),
        username: "courier-test",
        email: "",
        first_name: "Test",
        last_name: "",
      },
      organization: null,
      profiles: [],
      permissions: [],
      scope: { centers: [], quadrants: [] },
      organizations: [],
      limits: { void_reason_min_length: 10, void_reason_max_length: 1000 },
    },
  };
}

function response(events: Schemas["EventResult"][], revoked = false): Response {
  const result = answer(events);
  assert.ok(result.ok);
  return new Response(JSON.stringify(result.response), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...(revoked ? { "X-Session-Revoked": "true" } : {}),
    },
  });
}

void it("ending synchronously defeats a fifth wrong password while its end journal write is blocked; final sync keeps the pair", async () => {
  const stores = await createStores();
  const h = await makeCredentials();
  await h.credentials.update((current) => ({ ...current, passwordAttempts: 4 }));
  const pair = h.credentials.getSnapshot().pair;
  const entered = deferred<undefined>();
  const verified = deferred<boolean>();
  const journalEntered = deferred<undefined>();
  const journal = deferred<undefined>();
  const kv = {
    get: (key: string) => stores.kv.get(key),
    set: async (key: string, value: string) => {
      if (key === "session_ended") {
        journalEntered.resolve(undefined);
        await journal.promise;
      }
      await stores.kv.set(key, value);
    },
  };
  const auth = new AuthController({
    ...stores,
    kv,
    credentials: h.credentials,
    randomBytes,
    now: () => FIXED_NOW.getTime(),
    fetchRules: () => Promise.resolve(null),
    login: () => {
      throw new Error("No login during session end.");
    },
    verify: () => {
      entered.resolve(undefined);
      return verified.promise;
    },
  });
  await auth.load();
  await stores.kv.set("test_draft", "half-filled form");
  const event = makeEnvelope();
  await stores.outbox.enqueue(event);
  const wrong = auth.unlock(randomUUID(), "password");
  await entered.promise;
  const ending = auth.endSession();
  assert.equal(h.credentials.getSnapshot().status, "ended");
  await journalEntered.promise;
  verified.resolve(false);
  assert.equal(h.credentials.getSnapshot().pair, pair);
  assert.equal(auth.getSnapshot().phase, "login");
  journal.resolve(undefined);
  await Promise.all([wrong, ending]);
  assert.equal(h.credentials.getSnapshot().pair, pair);
  assert.equal(h.credentials.getSnapshot().status, "ended");
  const session = new SessionRequests({
    credentials: h.credentials,
    isOnline: () => true,
    endSession: () => auth.endSession(),
    refresh: () => {
      throw new Error("Ended pairs cannot refresh.");
    },
  });
  let posts = 0;
  const client = createMobileApiClient({
    baseUrl: "https://example.invalid",
    tokens: h.credentials,
    fetch: (request) => {
      posts += 1;
      assert.equal(request.headers.get("Authorization"), `Bearer ${String(pair?.access)}`);
      return Promise.resolve(response([accepted(event.id)], true));
    },
  });
  await runSyncPass(
    {
      ...stores,
      deviceId: FIXED_DEVICE_ID,
      now: () => FIXED_NOW,
      transport: createSyncTransport(client, session),
    },
    { batchSize: SYNC_BATCH_SIZE },
  );
  assert.equal(posts, 1);
  assert.equal((await stores.outbox.countByStatus()).sent, 1);
  assert.equal(h.credentials.getSnapshot().pair, null);
  assert.equal(await stores.kv.get("test_draft"), "half-filled form");
});

void it("a session end while sync is idle wakes a real final POST without a manual trigger", async () => {
  const stores = await createStores();
  const h = await makeCredentials();
  const auth = new AuthController({
    ...stores,
    credentials: h.credentials,
    randomBytes,
    now: () => FIXED_NOW.getTime(),
    fetchRules: () => Promise.resolve(null),
    login: () => {
      throw new Error("No login during final upload.");
    },
  });
  await auth.load();
  const event = makeEnvelope();
  await stores.outbox.enqueue(event);
  const finalEntered = deferred<undefined>();
  const finalResponse = deferred<Response>();
  let posts = 0;
  const session = new SessionRequests({
    credentials: h.credentials,
    isOnline: () => true,
    endSession: () => auth.endSession(),
    refresh: () => {
      throw new Error("No refresh is needed.");
    },
  });
  const client = createMobileApiClient({
    baseUrl: "https://example.invalid",
    tokens: h.credentials,
    fetch: () => {
      posts += 1;
      if (posts === 1) return Promise.resolve(response([accepted(event.id)]));
      finalEntered.resolve(undefined);
      return finalResponse.promise;
    },
  });
  const engine = new SyncEngine({
    pass: {
      ...stores,
      deviceId: FIXED_DEVICE_ID,
      now: () => FIXED_NOW,
      transport: createSyncTransport(client, session),
    },
    hasSession: () => h.credentials.hasSyncSession(),
    hasServer: () => true,
    random: () => 0,
    schedule: () => {
      throw new Error("No retry should be scheduled for this successful final upload.");
    },
    report: (error) => {
      throw error;
    },
  });
  let isArmed = false;
  let hasWoken = false;
  const woke = deferred<undefined>();
  const requestSync = engine.requestSync.bind(engine);
  engine.requestSync = () => {
    if (isArmed) {
      hasWoken = true;
      woke.resolve(undefined);
    }
    return requestSync();
  };
  const stop = observeSyncSession(engine, h.credentials);
  await engine.start();
  assert.equal(engine.getSnapshot().phase, "idle");
  isArmed = true;
  const ended = auth.endSession();
  await Promise.race([
    woke.promise,
    ended.then(() => {
      assert.equal(hasWoken, true, "Ending an idle session must request sync.");
    }),
  ]);
  await finalEntered.promise;
  finalResponse.resolve(response([], true));
  await ended;
  await engine.requestSync();
  stop();
  assert.equal(posts, 2);
  assert.equal(h.credentials.getSnapshot().pair, null);
  assert.equal(auth.getSnapshot().phase, "login");
});

void it("locking during the accepted login secure write preserves the session and derives password-required unlock before PIN setup", async () => {
  const stores = await createStores();
  const h = await makeCredentials();
  await h.credentials.clear();
  const login = loginReply();
  const password = randomUUID();
  const writing = deferred<undefined>();
  const write = deferred<undefined>();
  const credentials = new CredentialStore({
    ...h.secrets,
    set: async (key, value) => {
      const record: unknown = JSON.parse(value);
      if (
        typeof record === "object" &&
        record !== null &&
        "pair" in record &&
        record.pair !== null
      ) {
        writing.resolve(undefined);
        await write.promise;
      }
      await h.secrets.set(key, value);
    },
  });
  await credentials.load();
  const auth = new AuthController({
    ...stores,
    credentials,
    randomBytes,
    now: () => FIXED_NOW.getTime(),
    fetchRules: () => Promise.resolve(null),
    login: () => Promise.resolve({ ok: true, login }),
  });
  await auth.load();
  auth.setOnline(true);
  const loggingIn = auth.login("courier-test", password);
  await writing.promise;
  const locking = auth.lock();
  write.resolve(undefined);
  await Promise.all([loggingIn, locking]);
  assert.equal(credentials.getSnapshot().pair?.access, login.access);
  assert.equal(auth.getSnapshot().phase, "locked");
  assert.equal(auth.getSnapshot().isPasswordRequired, true);
  assert.equal(auth.canLogin(), false);
  await auth.unlock(password, "password");
  assert.equal(auth.getSnapshot().phase, "createPin");
  assert.equal(await auth.createPin("2846"), true);
  assert.equal(auth.getSnapshot().phase, "unlocked");
});

void it("only definitive settlement can erase an ended pair, even if a stale ordinary clear is submitted", async () => {
  const h = await makeCredentials();
  const pair = h.credentials.getSnapshot().pair;
  const id = h.credentials.getSnapshot().sessionId;
  const ending = h.credentials.markEnded(id);
  assert.equal(h.credentials.getSnapshot().status, "ended");
  const staleClear = h.credentials.clear();
  await Promise.all([ending, staleClear]);
  assert.equal(h.credentials.getSnapshot().pair, pair);
  await h.credentials.finishEndedSession(id);
  assert.equal(h.credentials.getSnapshot().pair, null);
});
