import assert from "node:assert/strict";
import { it } from "node:test";

import { observeSyncSession } from "../src/sync/observe-sync-session.ts";
import { SyncEngine } from "../src/sync/sync-engine.ts";
import type { SyncTransport } from "../src/sync/sync-transport.ts";
import { FIXED_DEVICE_ID, FIXED_NOW, createStores, makeEnvelope } from "./support/factories.ts";
import { accepted, answer } from "./support/scripted-transport.ts";
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

void it("a sign-in landing while a pass publishes needsLogin over an idle phase still sends", async () => {
  const stores = await createStores();
  const tokens = createMemoryTokenStore();
  const sent: string[] = [];
  let resolveSent: () => void = () => undefined;
  const eventSent = new Promise<void>((resolve) => {
    resolveSent = resolve;
  });
  let releaseCount: () => void = () => undefined;
  let resolveCounting: () => void = () => undefined;
  const counting = new Promise<void>((resolve) => {
    resolveCounting = resolve;
  });
  let isBarrierArmed = false;
  const original = stores.outbox;
  const outbox = new Proxy(original, {
    get(target, key) {
      const value: unknown = Reflect.get(target, key, target);
      if (typeof value !== "function") return value;
      const method = (value as (...args: unknown[]) => unknown).bind(target);
      if (key !== "countByStatus") return method;
      return async () => {
        if (isBarrierArmed) {
          isBarrierArmed = false;
          resolveCounting();
          await new Promise<void>((resolve) => {
            releaseCount = resolve;
          });
        }
        return method();
      };
    },
  });
  const transport: SyncTransport = (request) => {
    sent.push(...request.events.map((event) => event.id));
    if (request.events.length > 0) resolveSent();
    return Promise.resolve(answer(request.events.map((event) => accepted(event.id))));
  };
  const engine = new SyncEngine({
    pass: { ...stores, outbox, deviceId: FIXED_DEVICE_ID, now: () => FIXED_NOW, transport },
    hasSession: () => tokens.hasSyncSession(),
    hasPendingFinalUpload: () => Promise.resolve(false),
    hasServer: () => true,
    random: () => 0,
    schedule: () => () => undefined,
    report: (error) => {
      throw error;
    },
  });
  tokens.setAccessToken(`first-${String(Math.random())}`);
  const stop = observeSyncSession(engine, tokens);
  engine.setOnline(true);
  await engine.start();
  assert.equal(engine.getSnapshot().phase, "idle");
  const event = makeEnvelope();
  await original.enqueue(event);

  // The session goes away (hint starts a pass) and a new sign-in lands while that pass is
  // publishing needsLogin: the last published phase is still idle.
  isBarrierArmed = true;
  tokens.setAccessToken(undefined);
  await counting;
  tokens.setAccessToken(`second-${String(Math.random())}`);
  releaseCount();
  await eventSent;

  assert.deepEqual(sent, [event.id]);
  stop();
});
