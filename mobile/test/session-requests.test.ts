import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";

import { CredentialStore } from "../src/auth/credential-store.ts";
import { ConnectivityUnavailable } from "../src/sync/connectivity.ts";
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
    endSession: () => store.markEnded(store.getSnapshot().sessionId),
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
    endSession: () => credentials.markEnded(credentials.getSnapshot().sessionId),
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
    endSession: () => credentials.markEnded(credentials.getSnapshot().sessionId),
    refresh: () => {
      refreshes += 1;
      throw new RemoteSessionEnded();
    },
  });
  await assert.rejects(
    requests.run(() => Promise.resolve(expired())),
    ConnectivityUnavailable,
  );
  assert.equal(refreshes, 0);
  assert.notEqual(credentials.getAccessToken(), undefined);
  const online = new SessionRequests({
    credentials,
    isOnline: () => true,
    endSession: () => credentials.markEnded(credentials.getSnapshot().sessionId),
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
    endSession: () => credentials.markEnded(credentials.getSnapshot().sessionId),
    refresh: () => Promise.resolve({ access: randomUUID(), refresh: randomUUID() }),
  });
  let calls = 0;
  const revoked = () => ({
    response: new Response(null, { status: 401 }),
    error: { code: "session_revoked", detail: "" },
  });
  await requests.run(() => Promise.resolve(++calls === 1 ? expired() : revoked()));
  assert.notEqual(credentials.getSnapshot().pair, null);
  assert.equal(credentials.getSnapshot().status, "ended");
  await credentials.finishEndedSession(credentials.getSnapshot().sessionId);
  await credentials.update((current) => ({
    ...current,
    status: "active",
    pair: { access: randomUUID(), refresh: randomUUID() },
    sessionId: randomUUID(),
  }));
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

void it("a transient secure-write rejection does not poison later sync; pending end is persisted before the POST", async () => {
  for (const transition of ["ordinary", "end"]) {
    const h = await makeCredentials();
    let shouldFail = true;
    const credentials = new CredentialStore({
      ...h.secrets,
      set: async (key, value) => {
        if (shouldFail) {
          shouldFail = false;
          throw new Error("Transient secure-write failure.");
        }
        await h.secrets.set(key, value);
      },
    });
    await credentials.load();
    const session = new SessionRequests({
      credentials,
      isOnline: () => true,
      endSession: () => credentials.markEnded(credentials.getSnapshot().sessionId),
      refresh: () => {
        throw new Error("No refresh in this regression.");
      },
    });
    if (transition === "ordinary")
      await assert.rejects(credentials.update((current) => ({ ...current, pinAttempts: 1 })));
    else {
      await assert.rejects(
        session.run(() =>
          Promise.resolve({
            response: new Response(null, { status: 401 }),
            error: { code: "session_revoked", detail: "" },
          }),
        ),
      );
      assert.equal(credentials.getSnapshot().status, "ended");
    }
    let posts = 0;
    const result = await session.runSync(async (access) => {
      posts += 1;
      assert.equal(access, h.credentials.getSnapshot().pair?.access);
      if (transition === "end") {
        const restarted = new CredentialStore(h.secrets);
        await restarted.load();
        assert.equal(restarted.getSnapshot().status, "ended");
        assert.equal(restarted.getAccessToken(), undefined);
      }
      return {
        response: new Response(null, { status: 200, headers: { "X-Session-Revoked": "true" } }),
      };
    });
    assert.equal(posts, 1);
    assert.ok(result.completeSession);
    await result.completeSession();
    assert.equal(credentials.getSnapshot().pair, null);
  }
});

void it("keeps the server-rotated pair when a concurrent call ends the session before the refresh answer lands", async () => {
  const { credentials, secrets } = await makeCredentials();
  const entered = deferred<undefined>();
  const response = deferred<TokenPair>();
  const rotated = { access: randomUUID(), refresh: randomUUID() };
  const requests = new SessionRequests({
    credentials,
    isOnline: () => true,
    endSession: () => credentials.markEnded(credentials.getSnapshot().sessionId),
    refresh: () => {
      entered.resolve(undefined);
      return response.promise;
    },
  });
  const refreshing = requests.run(() => Promise.resolve(expired()));
  await entered.promise;
  await requests.run(() =>
    Promise.resolve({
      response: new Response(null, { status: 401 }),
      error: { code: "session_revoked", detail: "" },
    }),
  );
  assert.equal(credentials.getSnapshot().status, "ended");

  response.resolve(rotated);
  await refreshing.catch(() => undefined);

  assert.equal(credentials.getSnapshot().status, "ended");
  assert.deepEqual(credentials.getSnapshot().pair, rotated);
  assert.equal(credentials.getSnapshot().pin, null);
  const restarted = new CredentialStore(secrets);
  await restarted.load();
  assert.deepEqual(restarted.getSnapshot().pair, rotated);
});
