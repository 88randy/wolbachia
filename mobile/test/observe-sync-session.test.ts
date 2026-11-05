import assert from "node:assert/strict";
import { it } from "node:test";

import { observeSyncSession } from "../src/sync/observe-sync-session.ts";
import { SyncEngine } from "../src/sync/sync-engine.ts";
import type { SyncTransport } from "../src/sync/sync-transport.ts";
import { FIXED_DEVICE_ID, FIXED_NOW, createStores } from "./support/factories.ts";
import { answer } from "./support/scripted-transport.ts";
import { createMemoryTokenStore } from "./support/token-store.ts";

void it("a sign-in resumes a worker blocked on needsLogin without any other trigger", async () => {
  const stores = await createStores();
  const tokens = createMemoryTokenStore();
  let posts = 0;
  let resolvePosted: () => void = () => undefined;
  const posted = new Promise<void>((resolve) => {
    resolvePosted = resolve;
  });
  const transport: SyncTransport = () => {
    posts += 1;
    resolvePosted();
    return Promise.resolve(answer([]));
  };
  const engine = new SyncEngine({
    pass: { ...stores, deviceId: FIXED_DEVICE_ID, now: () => FIXED_NOW, transport },
    hasSession: () => tokens.hasSyncSession(),
    hasPendingFinalUpload: () => Promise.resolve(false),
    hasServer: () => true,
    random: () => 0,
    schedule: () => () => undefined,
    report: (error) => {
      throw error;
    },
  });
  const stop = observeSyncSession(engine, tokens);
  engine.setOnline(true);
  await engine.start();
  assert.equal(engine.getSnapshot().blockReason, "needsLogin");

  tokens.setAccessToken(`access-${String(Math.random())}`);
  await posted;

  assert.equal(posts, 1);
  stop();
});
