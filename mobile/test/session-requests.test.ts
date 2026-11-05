import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";

import { CredentialStore } from "../src/auth/credential-store.ts";
import { RemoteSessionEnded, SessionRequests } from "../src/auth/session-requests.ts";
import type { TokenPair } from "../src/auth/credential-store.ts";
import { deferred, makeCredentials } from "./support/auth-fakes.ts";

const expired = () => ({
  response: new Response(null, { status: 401 }),
  error: { code: "token_expired", detail: "" },
});

void it("shares one refresh across concurrent callers and does not retry until the pair is persisted", async () => {
  const { credentials, secrets } = await makeCredentials();
  const entered = deferred<undefined>();
  const response = deferred<TokenPair>();
  const saving = deferred<undefined>();
  const saved = deferred<undefined>();
  const replacement = { access: randomUUID(), refresh: randomUUID() };
  let refreshCalls = 0;
  let retries = 0;
  const store = new CredentialStore({
    ...secrets,
    set: async (key, value) => {
      saving.resolve(undefined);
      await saved.promise;
      await secrets.set(key, value);
    },
  });
  await store.load();
  const requests = new SessionRequests({
    credentials: store,
    isOnline: () => true,
    endSession: () => store.clear(),
    refresh: () => {
      refreshCalls += 1;
      entered.resolve(undefined);
      return response.promise;
    },
  });
  const call = async () => {
    if (store.getAccessToken() !== replacement.access) return expired();
    const restarted = new CredentialStore(secrets);
    await restarted.load();
    assert.equal(restarted.getAccessToken(), replacement.access);
    retries += 1;
    return { response: new Response(null, { status: 200 }) };
  };
  const first = requests.run(call);
  const second = requests.run(call);
  await entered.promise;
  response.resolve(replacement);
  await saving.promise;
  assert.equal(refreshCalls, 1);
  assert.equal(retries, 0);
  saved.resolve(undefined);
  await Promise.all([first, second]);
  assert.equal(retries, 2);
  assert.notEqual(credentials.getAccessToken(), replacement.access);
});

void it("retries a late old-access 401 with the already rotated pair instead of reusing its refresh", async () => {
  const { credentials } = await makeCredentials();
  const lateResponse = deferred<ReturnType<typeof expired>>();
  const entered = deferred<undefined>();
  let calls = 0;
  let refreshes = 0;
  const requests = new SessionRequests({
    credentials,
    isOnline: () => true,
    endSession: () => credentials.clear(),
    refresh: () => {
      refreshes += 1;
      return Promise.resolve({ access: randomUUID(), refresh: randomUUID() });
    },
  });
  const late = requests.run(() => {
    calls += 1;
    if (calls === 1) {
      entered.resolve(undefined);
      return lateResponse.promise;
    }
    return Promise.resolve({ response: new Response(null, { status: 200 }) });
  });
  await entered.promise;
  let currentCalls = 0;
  await requests.run(() =>
    Promise.resolve(
      ++currentCalls === 1 ? expired() : { response: new Response(null, { status: 200 }) },
    ),
  );
  lateResponse.resolve(expired());
  assert.equal((await late).response.status, 200);
  assert.equal(refreshes, 1);
});

void it("does not refresh offline; refresh expiry and bearer revoke end the session", async () => {
  const { credentials } = await makeCredentials();
  let refreshes = 0;
  const requests = new SessionRequests({
    credentials,
    isOnline: () => false,
    endSession: () => credentials.clear(),
    refresh: () => {
      refreshes += 1;
      throw new RemoteSessionEnded();
    },
  });
  await requests.run(() => Promise.resolve(expired()));
  assert.equal(refreshes, 0);
  assert.notEqual(credentials.getAccessToken(), undefined);
  const online = new SessionRequests({
    credentials,
    isOnline: () => true,
    endSession: () => credentials.clear(),
    refresh: () => Promise.reject(new RemoteSessionEnded()),
  });
  await assert.rejects(
    online.run(() => Promise.resolve(expired())),
    RemoteSessionEnded,
  );
  assert.equal(credentials.getSnapshot().password, null);
});

void it("handles a session-ended error on the retry, but ignores a stale response from a replaced login", async () => {
  const { credentials } = await makeCredentials();
  const requests = new SessionRequests({
    credentials,
    isOnline: () => true,
    endSession: () => credentials.clear(),
    refresh: () => Promise.resolve({ access: randomUUID(), refresh: randomUUID() }),
  });
  let calls = 0;
  const revoked = () => ({
    response: new Response(null, { status: 401 }),
    error: { code: "session_revoked", detail: "" },
  });
  await requests.run(() => Promise.resolve(++calls === 1 ? expired() : revoked()));
  assert.equal(credentials.getSnapshot().pair, null);
  const late = deferred<ReturnType<typeof revoked>>();
  const pending = requests.run(() => late.promise);
  const replacement = { access: randomUUID(), refresh: randomUUID() };
  await credentials.update((current) => ({
    ...current,
    pair: replacement,
    sessionId: randomUUID(),
  }));
  late.resolve(revoked());
  await pending;
  assert.equal(credentials.getAccessToken(), replacement.access);
});
