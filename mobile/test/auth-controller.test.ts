import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { it } from "node:test";
import type { Schemas } from "@wolbachia/api-client";

import { AuthController } from "../src/auth/auth-controller.ts";
import type { LoginResult } from "../src/auth/auth-api.ts";
import { CredentialStore } from "../src/auth/credential-store.ts";
import type { SecretStorage } from "../src/auth/secret-storage.ts";
import { ShiftOpenStore } from "../src/features/shift-open/store.ts";
import { createStores, makeEnvelope, FIXED_NOW } from "./support/factories.ts";
import { makeCredentials, deferred } from "./support/auth-fakes.ts";

async function harness(
  login: () => Promise<LoginResult>,
  fetchRules: () => Promise<unknown> = () => Promise.reject(new Error("offline")),
  storage?: (original: SecretStorage) => SecretStorage,
) {
  const stores = await createStores();
  const secrets = await makeCredentials();
  const credentials = storage ? new CredentialStore(storage(secrets.secrets)) : secrets.credentials;
  if (storage) await credentials.load();
  await stores.kv.set(
    "session_profile",
    JSON.stringify({
      username: "courier-test",
      firstName: "Test",
      organization: null,
      permissions: [],
    }),
  );
  const auth = new AuthController({
    ...stores,
    credentials,
    login,
    fetchRules,
    randomBytes,
    now: () => FIXED_NOW.getTime(),
  });
  await auth.load();
  return { ...stores, ...secrets, credentials, auth };
}

function loginResponse(): Schemas["MobileLoginResponse"] {
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
      scope: { centers: { mode: "none", ids: [] }, quadrants: { mode: "none", ids: [] } },
      organizations: [],
      limits: { void_reason_min_length: 10, void_reason_max_length: 1000 },
      is_platform_admin: false,
      must_change_password: false,
    },
  };
}

void it("enforces offline first-login and owner binding before any server call, while allowing the same username", async () => {
  let loginCalls = 0;
  const { auth, outbox, credentials } = await harness(() => {
    loginCalls += 1;
    return Promise.resolve({ ok: false, notice: { key: "mobile.login.wrongCredentials" } });
  });
  await outbox.enqueue(makeEnvelope());
  await auth.endSession();
  await credentials.finishEndedSession(credentials.getSnapshot().sessionId);
  await auth.login("courier-test", randomUUID());
  assert.equal(loginCalls, 0);
  auth.setOnline(true);
  await auth.login("other-courier", randomUUID());
  assert.equal(loginCalls, 0);
  assert.equal(auth.getSnapshot().notice?.key, "mobile.login.differentUser");
  await auth.login("courier-test", randomUUID());
  assert.equal(loginCalls, 1);
});

void it("a durable shift draft without outbox events refuses a different owner before login and permits its owner", async () => {
  let loginCalls = 0;
  const h = await harness(() => {
    loginCalls += 1;
    return Promise.resolve({ ok: true, origin: "https://example.invalid", login: loginResponse() });
  });
  const store = new ShiftOpenStore(h.db);
  const draft = {
    clientShiftId: randomUUID(),
    openingEventId: randomUUID(),
    catalogVersion: "",
    motorcycle_code: "M-03",
    checks: [],
    odometer_km: "12",
    photoRefs: [],
    note: "unfinished",
    step: "motorcycle" as const,
  };
  await store.createDraft(draft);
  await h.auth.endSession();
  await h.credentials.finishEndedSession(h.credentials.getSnapshot().sessionId);
  assert.ok(Object.values(await h.outbox.countByStatus()).every((count) => count === 0));
  h.auth.setOnline(true);
  await h.auth.login("other-courier", randomUUID());
  assert.equal(loginCalls, 0);
  assert.equal(h.auth.getSnapshot().notice?.key, "mobile.login.differentUser");
  await h.auth.login("courier-test", randomUUID());
  assert.equal(loginCalls, 1);
  assert.equal(h.auth.getSnapshot().phase, "createPin");
  assert.deepEqual((await store.read()).draft, draft);
});

void it("cold starts locked; biometric success keeps PIN attempts and cannot bypass the password-required state", async () => {
  const { auth, credentials, pinSecret } = await harness(() =>
    Promise.reject(new Error("must stay offline")),
  );
  assert.equal(auth.getSnapshot().phase, "locked");
  await auth.unlock(randomUUID(), "pin");
  await auth.unlockBiometric(auth.biometricGate());
  assert.equal(auth.getSnapshot().phase, "unlocked");
  assert.equal(credentials.getSnapshot().pinAttempts, 1);
  await auth.lock();
  await auth.unlock(randomUUID(), "pin");
  await auth.unlock(randomUUID(), "pin");
  assert.equal(auth.getSnapshot().isPasswordRequired, true);
  assert.equal(auth.canUseBiometrics(), false);
  await auth.unlockBiometric(auth.biometricGate());
  assert.equal(auth.getSnapshot().phase, "locked");
  await auth.unlock(pinSecret, "pin");
  assert.equal(auth.getSnapshot().phase, "locked");
});

void it("remote session end and local password exhaustion preserve the actual outbox, draft and owner binding", async () => {
  for (const reason of ["remote", "local"]) {
    const { auth, outbox, kv, credentials } = await harness(() =>
      Promise.reject(new Error("unused")),
    );
    const event = makeEnvelope();
    await outbox.enqueue(event);
    await kv.set("test_draft", "half-filled form");
    await endForTest(auth, reason);
    assert.equal(auth.getSnapshot().phase, "login");
    if (reason === "remote") assert.notEqual(credentials.getSnapshot().pair, null);
    else assert.equal(credentials.getSnapshot().pair, null);
    assert.equal(credentials.getSnapshot().pin, null);
    assert.equal(credentials.getSnapshot().password, null);
    const [pending] = await outbox.claimPending(1);
    assert.equal(pending?.envelope.id, event.id);
    assert.equal(await kv.get("test_draft"), "half-filled form");
    assert.equal(auth.getSnapshot().profile?.username, "courier-test");
    assert.equal(
      auth.getSnapshot().notice?.key,
      reason === "remote" ? "mobile.login.sessionEnded" : "mobile.login.onlineRequired",
    );
  }
});

void it("accepts online login despite a failed rules fetch, creates a PIN, and unlocks offline without any API call", async () => {
  let loginCalls = 0;
  const rules = deferred<unknown>();
  const { auth, credentials } = await harness(
    () => {
      loginCalls += 1;
      return Promise.resolve({
        ok: true,
        origin: "https://example.invalid",
        login: loginResponse(),
      });
    },
    () => rules.promise,
  );
  await auth.endSession();
  await credentials.finishEndedSession(credentials.getSnapshot().sessionId);
  auth.setOnline(true);
  await auth.login("courier-test", randomUUID());
  assert.equal(auth.getSnapshot().phase, "createPin");
  assert.equal(auth.getSnapshot().rules.pinMaxAttempts, 3);
  assert.equal(await auth.createPin("1234"), false);
  assert.equal(await auth.createPin("2846"), true);
  assert.equal(auth.getSnapshot().phase, "unlocked");
  const handled = deferred<undefined>();
  const stop = auth.subscribe(() => {
    handled.resolve(undefined);
  });
  rules.reject(new Error("rules temporarily unavailable"));
  await handled.promise;
  stop();
  assert.equal(auth.getSnapshot().rules.pinMaxAttempts, 3);
  assert.notEqual(credentials.getSnapshot().password, null);
  await auth.lock();
  auth.setOnline(false);
  await auth.unlock("2846", "pin");
  assert.equal(auth.getSnapshot().phase, "unlocked");
  assert.equal(loginCalls, 1);
});

void it("a refused login credential write preserves prior credentials and stays on login until a successful retry", async () => {
  let refuseWrite = false;
  const h = await harness(
    () => Promise.resolve({ ok: true, origin: "https://example.invalid", login: loginResponse() }),
    undefined,
    (original) => ({
      ...original,
      set: (key, value) =>
        refuseWrite ? Promise.reject(new Error("Secure commit refused")) : original.set(key, value),
    }),
  );
  await h.auth.endSession();
  await h.credentials.finishEndedSession(h.credentials.getSnapshot().sessionId);
  const previous = h.credentials.getSnapshot();
  const persisted = new Map(h.secrets.values);
  h.auth.setOnline(true);
  refuseWrite = true;
  await assert.rejects(h.auth.login("courier-test", randomUUID()), /Secure commit refused/);
  assert.equal(h.auth.getSnapshot().phase, "login");
  assert.equal(h.credentials.isUnlocked(), false);
  assert.deepEqual(h.credentials.getSnapshot(), previous);
  assert.deepEqual(h.secrets.values, persisted);
  refuseWrite = false;
  await h.auth.login("courier-test", randomUUID());
  assert.equal(h.auth.getSnapshot().phase, "createPin");
  assert.notEqual(h.credentials.getSnapshot().pair, null);
});

void it("a refused PIN credential write preserves the login and stays on PIN setup until a successful retry", async () => {
  let refuseWrite = false;
  const h = await harness(
    () => Promise.resolve({ ok: true, origin: "https://example.invalid", login: loginResponse() }),
    undefined,
    (original) => ({
      ...original,
      set: (key, value) =>
        refuseWrite ? Promise.reject(new Error("Secure commit refused")) : original.set(key, value),
    }),
  );
  await h.auth.endSession();
  await h.credentials.finishEndedSession(h.credentials.getSnapshot().sessionId);
  h.auth.setOnline(true);
  await h.auth.login("courier-test", randomUUID());
  const previous = h.credentials.getSnapshot();
  const persisted = new Map(h.secrets.values);
  refuseWrite = true;
  await assert.rejects(h.auth.createPin("2846"), /Secure commit refused/);
  assert.equal(h.auth.getSnapshot().phase, "createPin");
  assert.deepEqual(h.credentials.getSnapshot(), previous);
  assert.deepEqual(h.secrets.values, persisted);
  refuseWrite = false;
  assert.equal(await h.auth.createPin("2846"), true);
  assert.equal(h.auth.getSnapshot().phase, "unlocked");
});

async function endForTest(auth: AuthController, reason: string): Promise<void> {
  if (reason === "remote") {
    await auth.endSession();
    return;
  }
  for (let attempt = 0; attempt < 5; attempt += 1) await auth.unlock(randomUUID(), "password");
}
