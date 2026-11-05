import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";

import { createMobileApiClient } from "../src/api/create-api-client.ts";
import { SessionRequests } from "../src/auth/session-requests.ts";
import { createSyncTransport } from "../src/sync/sync-transport.ts";
import { SyncEngine } from "../src/sync/sync-engine.ts";
import { runSyncPass, SYNC_BATCH_SIZE } from "../src/sync/sync-pass.ts";
import { createStores, makeEnvelope, FIXED_DEVICE_ID, FIXED_NOW } from "./support/factories.ts";
import { makeCredentials } from "./support/auth-fakes.ts";
import { accepted, answer } from "./support/scripted-transport.ts";

void it("an expired access refreshes and retries inside the sync pass, leaving it idle with the event sent", async () => {
  const stores = await createStores();
  const { credentials } = await makeCredentials();
  const event = makeEnvelope();
  await stores.outbox.enqueue(event);
  let refreshes = 0;
  let calls = 0;
  const requests = new SessionRequests({
    credentials,
    isOnline: () => true,
    endSession: () => credentials.markEnded(credentials.getSnapshot().sessionId),
    refresh: () => {
      refreshes += 1;
      return Promise.resolve({ access: randomUUID(), refresh: randomUUID() });
    },
  });
  const result = answer([accepted(event.id)]);
  assert.ok(result.ok);
  const client = createMobileApiClient({
    baseUrl: "https://example.invalid",
    tokens: credentials,
    fetch: () => {
      calls += 1;
      return Promise.resolve(
        new Response(
          JSON.stringify(calls === 1 ? { code: "token_expired", detail: "" } : result.response),
          {
            status: calls === 1 ? 401 : 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    },
  });
  const engine = new SyncEngine({
    pass: {
      ...stores,
      deviceId: FIXED_DEVICE_ID,
      now: () => FIXED_NOW,
      transport: createSyncTransport(client, requests),
    },
    hasSession: () => credentials.getAccessToken() !== undefined,
    hasServer: () => true,
    random: () => 0,
    schedule: () => {
      throw new Error("Successful refresh must not leave a retry timer.");
    },
    report: (error) => {
      throw error;
    },
  });
  await engine.start();
  assert.equal(refreshes, 1);
  assert.equal(engine.getSnapshot().phase, "idle");
  assert.equal(engine.getSnapshot().blockReason, null);
  assert.equal(engine.getSnapshot().counts.sent, 1);
});

void it("connectivity loss before an expired-access answer is retryable, never needsLogin and never consumes refresh", async () => {
  const stores = await createStores();
  const h = await makeCredentials();
  const event = makeEnvelope();
  await stores.outbox.enqueue(event);
  let isOnline = true;
  const session = new SessionRequests({
    credentials: h.credentials,
    isOnline: () => isOnline,
    endSession: () => {
      throw new Error("Connectivity cannot end a session.");
    },
    refresh: () => {
      throw new Error("No refresh while offline.");
    },
  });
  const client = createMobileApiClient({
    baseUrl: h.credentials.getOrigin() ?? "",
    tokens: h.credentials,
    fetch: () => {
      isOnline = false;
      return Promise.resolve(
        new Response(JSON.stringify({ code: "token_expired", detail: "" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );
    },
  });
  const result = await runSyncPass(
    {
      ...stores,
      deviceId: FIXED_DEVICE_ID,
      now: () => FIXED_NOW,
      transport: createSyncTransport(client, session),
    },
    { batchSize: SYNC_BATCH_SIZE },
  );
  assert.equal(result.kind, "retry");
  assert.notEqual(h.credentials.getSnapshot().pair, null);
  assert.equal(h.credentials.getSnapshot().status, "active");
  assert.equal((await stores.outbox.countByStatus()).pending, 1);
});
