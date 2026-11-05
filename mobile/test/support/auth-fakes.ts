import { randomBytes, randomUUID } from "node:crypto";

import { CredentialStore, EMPTY_CREDENTIALS } from "../../src/auth/credential-store.ts";
import type { SecretStorage } from "../../src/auth/secret-storage.ts";
import { createVerifier } from "../../src/auth/verifier.ts";

export function memorySecrets(): SecretStorage & { readonly values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    get: (key) => Promise.resolve(values.get(key) ?? null),
    set: (key, value) => {
      values.set(key, value);
      return Promise.resolve();
    },
  };
}

export async function makeCredentials() {
  const secrets = memorySecrets();
  const credentials = new CredentialStore(secrets);
  const pinSecret = String(2000 + Math.floor(Math.random() * 7000));
  const passwordSecret = randomUUID();
  await credentials.update(() => ({
    ...EMPTY_CREDENTIALS,
    sessionId: randomUUID(),
    pair: { access: randomUUID(), refresh: randomUUID() },
    pin: null,
    password: null,
  }));
  const pin = await createVerifier(pinSecret, 1, randomBytes);
  const password = await createVerifier(passwordSecret, 1, randomBytes);
  await credentials.update((current) => ({ ...current, pin, password }));
  return { credentials, secrets, pinSecret, passwordSecret };
}

export function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Value>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
}
