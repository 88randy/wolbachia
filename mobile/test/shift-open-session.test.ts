import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { it } from "node:test";

import { createAuth } from "../src/auth/create-auth.ts";
import { ServerSettings } from "../src/config/server-settings.ts";
import { SyncEngine } from "../src/sync/sync-engine.ts";
import { createStores, FIXED_DEVICE_ID, FIXED_NOW } from "./support/factories.ts";
import { makeCredentials } from "./support/auth-fakes.ts";
import "./support/native-module-stubs.ts";

const { createShiftOpen } = await import("../src/features/shift-open/create-shift-open.ts");

const ORIGIN = "https://example.invalid";
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function snapshot(path: string): Response {
  return jsonResponse(
    path.endsWith("/catalog/")
      ? { version: "catalog-v2", catalogs: [] }
      : { version: "rules-v2", parameters: [] },
  );
}
async function harness(fetch: (request: Request) => Promise<Response>) {
  const stores = await createStores();
  const { credentials } = await makeCredentials();
  // A changed setting must never become the origin of an authenticated feature request.
  const server = new ServerSettings(stores.kv, "https://substitute.example.invalid", {
    credentials,
    outbox: stores.outbox,
  });
  const { auth, requests } = await createAuth({
    ...stores,
    credentials,
    server,
    deviceId: FIXED_DEVICE_ID,
    appVersion: "test",
    randomBytes,
    now: () => FIXED_NOW.getTime(),
    fetch,
  });
  auth.setOnline(true);
  const engine = new SyncEngine({
    pass: {
      ...stores,
      deviceId: FIXED_DEVICE_ID,
      now: () => FIXED_NOW,
      transport: () => {
        throw new Error("No sync during catalog download.");
      },
    },
    hasSession: () => true,
    hasServer: () => true,
    hasPendingFinalUpload: credentials.hasPendingFinalUpload,
    random: () => 0,
    schedule: () => {
      throw new Error("No retry timer during catalog download.");
    },
    report: (error) => {
      throw error;
    },
  });
  const service = createShiftOpen({
    db: stores.db,
    engine,
    tokens: credentials,
    requests,
    uuid: randomUUID,
    fetch,
  });
  return { ...stores, credentials, auth, service };
}

void it("shift catalog and rules each refresh expired access once and accept the same session's rotated bearer at its issuer", async () => {
  for (const endpoint of ["/catalog/", "/rules/"]) {
    const sent: Request[] = [];
    const rotated = { access: randomUUID(), refresh: randomUUID() };
    let hasExpired = false;
    const h = await harness((request) => {
      sent.push(request);
      const path = new URL(request.url).pathname;
      if (path.endsWith("/refresh/"))
        return Promise.resolve(jsonResponse({ ...rotated, server_time: FIXED_NOW.toISOString() }));
      if (path.endsWith(endpoint) && !hasExpired) {
        hasExpired = true;
        return Promise.resolve(jsonResponse({ code: "token_expired", detail: "" }, 401));
      }
      return Promise.resolve(snapshot(path));
    });
    await h.service.start();
    const draft = (await h.service.read()).draft;
    await h.service.refreshCatalog();
    assert.equal(sent.filter((request) => request.url.endsWith("/refresh/")).length, 1);
    assert.ok(sent.every((request) => new URL(request.url).origin === ORIGIN));
    assert.equal(sent.at(-1)?.headers.get("Authorization"), `Bearer ${rotated.access}`);
    assert.equal(h.auth.getSnapshot().phase, "locked");
    assert.equal((await h.service.read()).catalog?.version, "catalog-v2");
    assert.equal(
      await h.kv.get("shift_open_rules"),
      JSON.stringify({ version: "rules-v2", parameters: [] }),
    );
    assert.deepEqual((await h.service.read()).draft, draft);
  }
});

void it("session_revoked from either shift GET closes local auth and preserves the durable draft", async () => {
  for (const endpoint of ["/catalog/", "/rules/"]) {
    const sent: Request[] = [];
    const h = await harness((request) => {
      sent.push(request);
      const path = new URL(request.url).pathname;
      return Promise.resolve(
        path.endsWith(endpoint)
          ? jsonResponse({ code: "session_revoked", detail: "" }, 401)
          : snapshot(path),
      );
    });
    await h.service.start();
    const draft = (await h.service.read()).draft;
    await assert.rejects(h.service.refreshCatalog());
    assert.equal(h.auth.getSnapshot().phase, "login");
    assert.equal(h.auth.getSnapshot().notice?.key, "mobile.login.sessionEnded");
    assert.equal(h.credentials.getSnapshot().status, "ended");
    assert.notEqual(h.credentials.getSnapshot().pair, null);
    assert.deepEqual((await h.service.read()).draft, draft);
    assert.ok(sent.every((request) => new URL(request.url).origin === ORIGIN));
    assert.equal(sent.filter((request) => request.url.endsWith("/refresh/")).length, 0);
  }
});
