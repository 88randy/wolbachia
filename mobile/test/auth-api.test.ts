import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";

import { createMobileApiClient } from "../src/api/create-api-client.ts";
import { loginOnline, refreshOnline } from "../src/auth/auth-api.ts";
import { RemoteSessionEnded } from "../src/auth/session-requests.ts";

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
  await loginOnline(client, {
    username: "courier-test",
    password,
    device_id: deviceId,
    app_version: "test-version",
  });
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
