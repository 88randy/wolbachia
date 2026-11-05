import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";

import { createMobileApiClient } from "../src/api/create-api-client.ts";
import { loginOnline, refreshOnline } from "../src/auth/auth-api.ts";
import { RemoteSessionEnded, SessionRequests } from "../src/auth/session-requests.ts";
import { CredentialStore } from "../src/auth/credential-store.ts";
import { loginResponse, makeCredentials } from "./support/auth-fakes.ts";

void it("sends device-bound login and refresh bodies anonymously, including the build version on login", async () => {
  const sent: Request[] = [];
  const client = createMobileApiClient({
    baseUrl: "https://example.invalid",
    fetch: (request) => {
      sent.push(request.clone());
      return Promise.resolve(
        new Response(JSON.stringify({ code: "invalid_credentials", detail: "" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );
    },
  });
  const deviceId = randomUUID();
  const password = randomUUID();
  const pair = { access: randomUUID(), refresh: randomUUID() };
  await loginOnline(
    client,
    {
      username: "courier-test",
      password,
      device_id: deviceId,
      app_version: "test-version",
    },
    "https://example.invalid",
  );
  await assert.rejects(refreshOnline(client, pair, deviceId));
  assert.equal(sent[0]?.headers.get("Authorization"), null);
  assert.equal(sent[1]?.headers.get("Authorization"), null);
  assert.deepEqual(await sent[0].json(), {
    username: "courier-test",
    password,
    device_id: deviceId,
    app_version: "test-version",
  });
  assert.deepEqual(await sent[1].json(), { refresh: pair.refresh, device_id: deviceId });
});

void it("classifies refresh expiry, invalid tokens and device/session revoke as a confirmed session end", async () => {
  for (const code of [
    "token_expired",
    "invalid_token",
    "session_revoked",
    "device_revoked",
    "refresh_reuse",
  ]) {
    const client = createMobileApiClient({
      baseUrl: "https://example.invalid",
      fetch: () =>
        Promise.resolve(
          new Response(JSON.stringify({ code, detail: "" }), {
            status: code === "device_revoked" ? 403 : 401,
            headers: { "Content-Type": "application/json" },
          }),
        ),
    });
    await assert.rejects(
      refreshOnline(client, { access: randomUUID(), refresh: randomUUID() }, randomUUID()),
      RemoteSessionEnded,
    );
  }
});

void it("malformed 200 refresh tokens never replace the previous usable credentials", async () => {
  for (const malformed of [
    {},
    { access: "", refresh: randomUUID() },
    { access: randomUUID(), refresh: null },
    { access: 42, refresh: randomUUID() },
  ]) {
    const h = await makeCredentials();
    const previous = h.credentials.getSnapshot();
    const client = createMobileApiClient({
      baseUrl: "https://example.invalid",
      fetch: () =>
        Promise.resolve(
          new Response(JSON.stringify(malformed), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
    });
    const session = new SessionRequests({
      credentials: h.credentials,
      isOnline: () => true,
      endSession: () => h.credentials.markEnded(previous.sessionId),
      refresh: (pair) => refreshOnline(client, pair, randomUUID()),
    });
    await assert.rejects(
      session.run(() =>
        Promise.resolve({
          response: new Response(null, { status: 401 }),
          error: { code: "token_expired", detail: "" },
        }),
      ),
    );
    assert.deepEqual(h.credentials.getSnapshot(), previous);
    const restarted = new CredentialStore(h.secrets);
    await restarted.load();
    assert.deepEqual(restarted.getSnapshot(), previous);
  }
});

void it("malformed login tokens, server time or consumed profile fields are rejected before acceptance", async () => {
  const valid = loginResponse();
  const malformed = [
    {},
    { ...valid, access: "" },
    { ...valid, refresh: 7 },
    { ...valid, server_time: "invalid" },
    { ...valid, me: null },
    { ...valid, me: { ...valid.me, user: { ...valid.me.user, first_name: null } } },
    { ...valid, me: { ...valid.me, permissions: [false] } },
  ];
  for (const body of malformed) {
    const client = createMobileApiClient({
      baseUrl: "https://example.invalid",
      fetch: () =>
        Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
    });
    const result = await loginOnline(
      client,
      { username: "courier-test", password: randomUUID(), device_id: randomUUID() },
      "https://example.invalid",
    );
    assert.equal(result.ok, false);
  }
});
