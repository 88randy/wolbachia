import assert from "node:assert/strict";
import { it } from "node:test";
import { randomUUID } from "node:crypto";

import { CredentialStore } from "../src/auth/credential-store.ts";
import { makeCredentials, memorySecrets, deferred } from "./support/auth-fakes.ts";

import { ServerSettings } from "../src/config/server-settings.ts";
import { KV_KEYS } from "../src/db/kv-store.ts";
import { createStores } from "./support/factories.ts";

void it("release Settings rejects http before saving and ignores an old debug override", async () => {
  const { kv, outbox } = await createStores();
  const credentials = new CredentialStore(memorySecrets());
  const policy = { credentials, outbox };
  const debug = new ServerSettings(kv, undefined, { ...policy, allowCleartext: true });
  await debug.save("http://10.0.0.1");
  const release = new ServerSettings(kv, "https://api.example.com", policy);
  await release.load();

  assert.equal(release.baseUrl(), "https://api.example.com");
  assert.deepEqual(await release.save("http://192.168.1.20"), {
    ok: false,
    problem: "cleartextNotAllowed",
  });
  assert.equal(await kv.get(KV_KEYS.apiBaseUrlOverride), "http://10.0.0.1");
});

for (const boundBy of ["active", "ended", "pending", "sending", "error", "owner"] as const) {
  void it(`refuses server substitution and reset when identity is bound by ${boundBy}`, async () => {
    const { kv, outbox } = await createStores();
    const { credentials } = await makeCredentials();
    if (boundBy === "ended") await credentials.markEnded(credentials.getSnapshot().sessionId);
    else if (boundBy !== "active") await credentials.clear();
    if (boundBy === "owner")
      await kv.set("session_profile", JSON.stringify({ username: "test-owner" }));
    const counts = await outbox.countByStatus();
    const guardedOutbox = {
      countByStatus: () =>
        Promise.resolve({
          ...counts,
          ...(["pending", "sending", "error"].includes(boundBy) ? { [boundBy]: 1 } : {}),
        }),
    };
    const server = new ServerSettings(kv, "https://original.example.invalid", {
      credentials,
      outbox: guardedOutbox,
    });
    const refused = { ok: false, problem: "identityBound" };
    assert.deepEqual(await server.save("https://substitute.example.invalid"), refused);
    assert.deepEqual(await server.clear(), refused);
    assert.equal(await server.canChange(), false);
    assert.equal(server.baseUrl(), "https://original.example.invalid");
    assert.equal(await kv.get(KV_KEYS.apiBaseUrlOverride), null);
  });
}

void it("allows initial server provisioning and reset only on a fresh phone", async () => {
  const { kv, outbox } = await createStores();
  const credentials = new CredentialStore(memorySecrets());
  const server = new ServerSettings(kv, "https://build.example.invalid", { credentials, outbox });
  assert.equal(await server.canChange(), true);
  assert.deepEqual(await server.save("https://provisioned.example.invalid"), {
    ok: true,
    url: "https://provisioned.example.invalid",
  });
  assert.equal(server.baseUrl(), "https://provisioned.example.invalid");
  assert.deepEqual(await server.clear(), { ok: true });
  assert.equal(server.baseUrl(), "https://build.example.invalid");
});

void it("server mutation waits behind accepted credentials and cannot redirect a pair hidden during its native save", async () => {
  const { kv, outbox } = await createStores();
  const secrets = memorySecrets();
  const entered = deferred<undefined>();
  const saved = deferred<undefined>();
  const credentials = new CredentialStore({
    ...secrets,
    set: async (key, value) => {
      entered.resolve(undefined);
      await saved.promise;
      await secrets.set(key, value);
    },
  });
  const server = new ServerSettings(kv, "https://original.example.invalid", {
    credentials,
    outbox,
  });
  const accepting = credentials.update((current) => ({
    ...current,
    sessionId: randomUUID(),
    pair: { access: randomUUID(), refresh: randomUUID() },
  }));
  await entered.promise;
  assert.equal(credentials.hasSyncSession(), false);
  const changing = server.save("https://substitute.example.invalid");
  saved.resolve(undefined);
  await accepting;
  assert.deepEqual(await changing, { ok: false, problem: "identityBound" });
  assert.equal(server.baseUrl(), "https://original.example.invalid");
});
