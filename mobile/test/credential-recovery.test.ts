import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { it } from "node:test";

import { createAuth } from "../src/auth/create-auth.ts";
import { CredentialStore } from "../src/auth/credential-store.ts";
import { ServerSettings } from "../src/config/server-settings.ts";
import { makeCredentials } from "./support/auth-fakes.ts";
import { createStores, FIXED_DEVICE_ID, FIXED_NOW, makeEnvelope } from "./support/factories.ts";

const ORIGIN = "https://issuer.example.invalid";
const ITEM = "session_credentials_v1";
void it("undecodable credentials cannot brick auth startup or unlock, and keep the real profile, outbox and draft", async () => {
  for (const scenario of ["json", "pair", "origin", "unboundLegacy", "null"]) {
    const stores = await createStores();
    const h = await makeCredentials();
    const profile = {
      username: "courier-test",
      firstName: "Test",
      organization: null,
      permissions: [],
    };
    await stores.kv.set("session_profile", JSON.stringify(profile));
    await stores.kv.set("test_draft", "half-filled form");
    await stores.outbox.enqueue(makeEnvelope());
    const valid = h.credentials.getSnapshot();
    const broken =
      scenario === "json"
        ? "{"
        : scenario === "null"
          ? "null"
          : JSON.stringify({
              ...valid,
              ...(scenario === "pair"
                ? { pair: {} }
                : {
                    origin:
                      scenario === "origin" ? "https://issuer.example.invalid/api" : undefined,
                  }),
            });
    await h.secrets.set(ITEM, broken);
    const credentials = new CredentialStore(h.secrets);
    const server = new ServerSettings(stores.kv, ORIGIN, { credentials, outbox: stores.outbox });
    await credentials.load(undefined, scenario === "unboundLegacy" ? null : server.baseUrl());
    const { auth } = await createAuth({
      ...stores,
      credentials,
      server,
      deviceId: FIXED_DEVICE_ID,
      appVersion: "test",
      randomBytes,
      now: () => FIXED_NOW.getTime(),
      fetch: () => {
        throw new Error("Recovery cannot send anything.");
      },
    });
    await auth.unlock(h.pinSecret, "pin");
    await auth.unlock(h.passwordSecret, "password");
    assert.equal(auth.getSnapshot().phase, "login");
    assert.equal(credentials.hasSyncSession(), false);
    assert.equal(auth.canUseBiometrics(), false);
    assert.deepEqual(auth.getSnapshot().profile, profile);
    assert.equal((await stores.outbox.countByStatus()).pending, 1);
    assert.equal(await stores.kv.get("test_draft"), "half-filled form");
    assert.equal(await server.canChange(), false);
  }
});

void it("legacy active/ended credentials migrate once to the configured origin and keep that binding across later configuration changes", async () => {
  for (const status of ["active", "ended"] as const) {
    const h = await makeCredentials();
    const legacy = { ...h.credentials.getSnapshot(), status };
    const withoutOrigin = { ...legacy, origin: undefined };
    await h.secrets.set(ITEM, JSON.stringify(withoutOrigin));
    const migrated = new CredentialStore(h.secrets);
    await migrated.load(undefined, ORIGIN);
    assert.equal(migrated.getSnapshot().origin, ORIGIN);
    assert.deepEqual(migrated.getSnapshot().pair, legacy.pair);
    assert.equal(migrated.getSnapshot().status, status);
    const restarted = new CredentialStore(h.secrets);
    await restarted.load(undefined, "https://another.example.invalid");
    assert.equal(restarted.getSnapshot().origin, ORIGIN);
  }
});
