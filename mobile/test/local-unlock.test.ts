import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { it } from "node:test";

import { CredentialStore } from "../src/auth/credential-store.ts";
import { LocalUnlock } from "../src/auth/local-unlock.ts";
import { isAllowedPin } from "../src/auth/pin-rules.ts";
import { createVerifier, verifySecret } from "../src/auth/verifier.ts";
import { deferred, makeCredentials } from "./support/auth-fakes.ts";

void it("rejects short, nonnumeric, repeated and sequential PINs while allowing a nontrivial four digits", () => {
  for (const pin of ["", "123", "12345", "12a4", "1111", "1234", "4321", "0123", "9876"]) {
    assert.equal(isAllowedPin(pin), false, pin);
  }
  assert.equal(isAllowedPin("2846"), true);
});

void it("verifies round trips with per-verifier random salts and rejects a wrong secret", async () => {
  const secret = randomUUID();
  const first = await createVerifier(secret, 2, randomBytes);
  const second = await createVerifier(secret, 2, randomBytes);
  assert.notEqual(first.salt, second.salt);
  assert.equal(await verifySecret(secret, first), true);
  assert.equal(await verifySecret(randomUUID(), first), false);
});

void it("persists an attempt before verification; a restart retains it and the limit forces full password", async () => {
  const { credentials, secrets, passwordSecret } = await makeCredentials();
  const entered = deferred<undefined>();
  const verification = deferred<boolean>();
  const unlock = new LocalUnlock({
    credentials,
    getPinLimit: () => 1,
    verify: () => {
      entered.resolve(undefined);
      return verification.promise;
    },
  });
  const attempt = unlock.attempt(randomUUID(), "pin");
  await entered.promise;
  const restarted = new CredentialStore(secrets);
  await restarted.load();
  assert.equal(restarted.getSnapshot().pinAttempts, 1);
  assert.equal(unlock.canUseBiometrics(), false);
  assert.equal(await unlock.attempt(randomUUID(), "pin"), false);
  verification.resolve(false);
  assert.equal(await attempt, false);
  const next = new LocalUnlock({ credentials: restarted, getPinLimit: () => 1 });
  assert.equal(next.isPasswordRequired(), true);
  assert.equal(await next.attempt(passwordSecret, "password"), true);
  assert.equal(next.isPasswordRequired(), false);
  assert.equal(restarted.getSnapshot().pinAttempts, 0);
});

void it("an in-flight local verification cannot undo remote credential erasure", async () => {
  const { credentials } = await makeCredentials();
  const entered = deferred<undefined>();
  const result = deferred<boolean>();
  const unlock = new LocalUnlock({
    credentials,
    getPinLimit: () => 3,
    verify: () => {
      entered.resolve(undefined);
      return result.promise;
    },
  });
  const attempt = unlock.attempt(randomUUID(), "pin");
  await entered.promise;
  await credentials.clear();
  result.resolve(true);
  assert.equal(await attempt, false);
  assert.equal(credentials.getSnapshot().pair, null);
});

void it("a killed final password attempt is consumed and requires online login on restart", async () => {
  const { credentials, secrets } = await makeCredentials();
  await credentials.update((current) => ({ ...current, passwordAttempts: 4 }));
  const entered = deferred<undefined>();
  const verification = deferred<boolean>();
  const unlock = new LocalUnlock({
    credentials,
    getPinLimit: () => 3,
    verify: () => {
      entered.resolve(undefined);
      return verification.promise;
    },
  });
  const attempt = unlock.attempt(randomUUID(), "password");
  await entered.promise;
  const restarted = new CredentialStore(secrets);
  await restarted.load();
  assert.equal(restarted.getSnapshot().pair, null);
  assert.equal(restarted.getSnapshot().password, null);
  verification.resolve(false);
  await attempt;
});

void it("a failed write-ahead counter never calls the verifier", async () => {
  const { secrets } = await makeCredentials();
  const restored = new CredentialStore({
    ...secrets,
    set: () => Promise.reject(new Error("Secure storage unavailable")),
  });
  await restored.load();
  let checks = 0;
  const unlock = new LocalUnlock({
    credentials: restored,
    getPinLimit: () => 3,
    verify: () => {
      checks += 1;
      return Promise.resolve(true);
    },
  });
  await assert.rejects(unlock.attempt(randomUUID(), "pin"));
  assert.equal(checks, 0);
});

void it("a valid PIN still unlocks if sync rotates tokens during its verification", async () => {
  const { credentials } = await makeCredentials();
  const entered = deferred<undefined>();
  const verification = deferred<boolean>();
  const unlock = new LocalUnlock({
    credentials,
    getPinLimit: () => 3,
    verify: () => {
      entered.resolve(undefined);
      return verification.promise;
    },
  });
  const attempt = unlock.attempt(randomUUID(), "pin");
  await entered.promise;
  await credentials.update((current) => ({
    ...current,
    pair: { access: randomUUID(), refresh: randomUUID() },
  }));
  verification.resolve(true);
  assert.equal(await attempt, true);
  assert.equal(credentials.getSnapshot().pinAttempts, 0);
});
