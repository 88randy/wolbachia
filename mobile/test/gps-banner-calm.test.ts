import assert from "node:assert/strict";
import { test } from "node:test";
import { CalmGps, GPS_CALM_MS, keepsGpsSlot } from "../src/features/safety/global-state.ts";
import type { GpsLevel } from "../src/features/safety/global-state.ts";

/** Timers are released by hand: nothing waits on a real clock. */
function fixture() {
  const timers: { run: () => void; ms: number; cancelled: boolean }[] = [];
  const shown: GpsLevel[] = [];
  const calm = new CalmGps({
    schedule: (run, ms) => {
      const timer = { run, ms, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
    publish: (level) => {
      shown.push(level);
    },
  });
  const fire = () => {
    for (const timer of timers.splice(0)) if (!timer.cancelled) timer.run();
  };
  return { calm, timers, shown, fire };
}

void test("one poor fix between good ones never shows the approximate banner", () => {
  const f = fixture();
  f.calm.set("unreliable");
  f.calm.set("ok");
  f.calm.set("unreliable");
  f.calm.set("ok");
  f.fire();
  assert.deepEqual(f.shown, []);
});

void test("approximate shows after holding the window, and one good fix does not clear it", () => {
  const f = fixture();
  f.calm.set("unreliable");
  assert.equal(f.timers[0]?.ms, GPS_CALM_MS);
  f.fire();
  assert.deepEqual(f.shown, ["unreliable"]);
  f.calm.set("ok");
  f.calm.set("unreliable");
  f.fire();
  assert.deepEqual(f.shown, ["unreliable"]);
  f.calm.set("ok");
  f.fire();
  assert.deepEqual(f.shown, ["unreliable", "ok"]);
});

void test("off and denied show at once; a stopped change is armed again by the next set", () => {
  const f = fixture();
  f.calm.set("off");
  assert.deepEqual(f.shown, ["off"]);
  f.calm.set("searching");
  f.calm.stop();
  f.fire();
  assert.deepEqual(f.shown, ["off"]);
  f.calm.set("searching");
  f.fire();
  assert.deepEqual(f.shown, ["off", "searching"]);
});

void test("the GPS slot stays reserved while watching and is released when the watch ends", () => {
  assert.equal(keepsGpsSlot(false, false, true), false);
  assert.equal(keepsGpsSlot(false, true, true), true);
  // The banner clears but the slot stays: the buttons below do not move.
  assert.equal(keepsGpsSlot(true, false, true), true);
  assert.equal(keepsGpsSlot(true, true, false), false);
});
