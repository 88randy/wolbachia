import assert from "node:assert/strict";
import { it } from "node:test";

import { IdleLock } from "../src/auth/idle-lock.ts";

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
