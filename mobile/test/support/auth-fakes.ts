import { randomBytes, randomUUID } from "node:crypto";
import type { Schemas } from "@wolbachia/api-client";

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
    origin: "https://example.invalid",
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

export function loginResponse(): Schemas["MobileLoginResponse"] {
  return {
    access: randomUUID(),
    refresh: randomUUID(),
    server_time: "2026-11-05T12:00:00Z",
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
    },
  };
}
