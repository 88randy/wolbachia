import assert from "node:assert/strict";
import { it } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";

import { IdleLock } from "../src/auth/idle-lock.ts";
import { shouldRunIdleTimer } from "../src/auth/idle-policy.ts";
import { AuthController } from "../src/auth/auth-controller.ts";
import { CredentialStore } from "../src/auth/credential-store.ts";
import { loginResponse, memorySecrets } from "./support/auth-fakes.ts";

function fakeClock() {
  let now = 0;
  const timers = new Map<symbol, { at: number; callback: () => void }>();
  return {
    schedule: (callback: () => void, delay: number) => {
      const id = Symbol();
      timers.set(id, { at: now + delay, callback });
      return () => {
        timers.delete(id);
      };
    },
    advance: (milliseconds: number) => {
      now += milliseconds;
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= now);
      for (const [id, timer] of due) {
        if (timers.delete(id)) timer.callback();
      }
    },
  };
}

void it("warns at T-1 minute, locks at T, resets on touch and locks immediately in background", () => {
  const clock = fakeClock();
  let isWarning = false;
  let locks = 0;
  const idle = new IdleLock({
    schedule: clock.schedule,
    warn: (value) => {
      isWarning = value;
    },
    lock: () => {
      locks += 1;
    },
  });
  idle.start(5);
  clock.advance(239_999);
  assert.equal(isWarning, false);
  clock.advance(1);
  assert.equal(isWarning, true);
  idle.touch();
  assert.equal(isWarning, false);
  clock.advance(299_999);
  assert.equal(locks, 0);
  clock.advance(1);
  assert.equal(locks, 1);
  idle.start(5);
  idle.background();
  assert.equal(locks, 2);
  clock.advance(300_000);
  assert.equal(locks, 2);
});

void it("keeps idle protection active in unlocked and createPin (entry or confirmation), but not login or locked", () => {
  assert.equal(shouldRunIdleTimer("unlocked"), true);
  assert.equal(shouldRunIdleTimer("createPin"), true);
  assert.equal(shouldRunIdleTimer("login"), false);
  assert.equal(shouldRunIdleTimer("locked"), false);
});

void it("PIN setup warns then locks on idle expiry, touch resets the deadline, and only the local password can resume creation", async () => {
  const values = new Map<string, string>();
  const credentials = new CredentialStore(memorySecrets());
  const password = randomUUID();
  const auth = new AuthController({
    credentials,
    kv: {
      get: (key) => Promise.resolve(values.get(key) ?? null),
      set: (key, value) => {
        values.set(key, value);
        return Promise.resolve();
      },
    },
    hasLocalRecords: () => Promise.resolve(false),
    login: () =>
      Promise.resolve({ ok: true, origin: "https://example.invalid", login: loginResponse() }),
    fetchRules: () => Promise.resolve(null),
    randomBytes,
    now: () => Date.parse("2026-11-05T12:00:00Z"),
  });
  await auth.load();
  auth.setOnline(true);
  await auth.login("courier-test", password);
  assert.equal(auth.getSnapshot().phase, "createPin");
  const clock = fakeClock();
  let isWarning = false;
  let locking = Promise.resolve();
  const idle = new IdleLock({
    schedule: clock.schedule,
    warn: (value) => {
      isWarning = value;
    },
    lock: () => {
      locking = auth.lock();
    },
  });
  const minuteMs = 60_000;
  const timeoutMs = auth.getSnapshot().rules.sessionIdleMinutes * minuteMs;
  if (shouldRunIdleTimer(auth.getSnapshot().phase))
    idle.start(auth.getSnapshot().rules.sessionIdleMinutes);
  clock.advance(timeoutMs - minuteMs - 1);
  assert.equal(isWarning, false);
  clock.advance(1);
  assert.equal(isWarning, true);
  idle.touch();
  assert.equal(isWarning, false);
  clock.advance(timeoutMs - 1);
  assert.equal(auth.getSnapshot().phase, "createPin");
  assert.equal(isWarning, true);
  clock.advance(1);
  await locking;
  assert.equal(auth.getSnapshot().phase, "locked");
  assert.equal(auth.getSnapshot().isPasswordRequired, true);
  assert.equal(auth.getSnapshot().isPinSetupRequired, true);
  assert.equal(await auth.createPin("2846"), false);
  auth.setOnline(false);
  await auth.unlock(password, "password");
  assert.equal(auth.getSnapshot().phase, "createPin");
  assert.equal(await auth.createPin("2846"), true);
  assert.equal(auth.getSnapshot().phase, "unlocked");
});
