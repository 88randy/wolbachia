import assert from "node:assert/strict";
import { test } from "node:test";
import type { LocationObject } from "expo-location";
import { createAndroidLocation } from "../src/features/day/create-android-location.ts";
import type { LocationState } from "../src/features/day/location.ts";
import { locationStatus } from "../src/features/ovitrap-check/location-status.ts";
import { deriveGlobalStates } from "../src/features/safety/global-state.ts";

const ACCURACY = { Balanced: 3, High: 4 };
const FIX: LocationObject = {
  coords: {
    latitude: 19.4,
    longitude: -99.1,
    altitude: null,
    accuracy: 35,
    altitudeAccuracy: null,
    heading: null,
    speed: 0,
  },
  timestamp: 1000,
};

/** Every native call is a controlled promise or callback: nothing waits on a real clock. */
function fixture(overrides: { readonly isServiceOn?: boolean; readonly isGranted?: boolean } = {}) {
  const watchers: { accuracy: number; emit: (fix: LocationObject) => void; removed: boolean }[] =
    [];
  const current: { resolve: (fix: LocationObject) => void; reject: () => void }[] = [];
  const timers: { run: () => void; cancelled: boolean }[] = [];
  const states: LocationState[] = [];
  const source = createAndroidLocation({
    api: {
      Accuracy: ACCURACY,
      hasServicesEnabledAsync: () => Promise.resolve(overrides.isServiceOn ?? true),
      requestForegroundPermissionsAsync: () =>
        Promise.resolve({ granted: overrides.isGranted ?? true }),
      getLastKnownPositionAsync: () => Promise.resolve(null),
      getCurrentPositionAsync: () =>
        new Promise<LocationObject>((resolve, reject) => {
          current.push({
            resolve,
            reject: () => {
              reject(new Error("no fix"));
            },
          });
        }),
      watchPositionAsync: (
        options: { accuracy?: number },
        callback: (fix: LocationObject) => void,
      ) => {
        const watcher = { accuracy: options.accuracy ?? 0, emit: callback, removed: false };
        watchers.push(watcher);
        return Promise.resolve({
          remove: () => {
            watcher.removed = true;
          },
        });
      },
    } as never,
    schedule: (run) => {
      const timer = { run, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
  });
  return {
    source,
    watchers,
    current,
    timers,
    states,
    publish: (s: LocationState) => {
      states.push(s);
    },
  };
}

void test("no fix before the wait ends: one calm noFix, and the step and the banner agree", async () => {
  const f = fixture();
  await f.source.start(f.publish);
  assert.deepEqual(f.states, [{ kind: "searching" }]);
  // One Balanced watch only (it works indoors).
  assert.deepEqual(
    f.watchers.map((watcher) => watcher.accuracy),
    [ACCURACY.Balanced],
  );
  f.timers[0]?.run();
  assert.deepEqual(f.states.at(-1), { kind: "noFix" });
  const last = f.states.at(-1) as LocationState;
  assert.deepEqual(locationStatus(last), { kind: "missing" });
  // The global banner has no searching message once the wait is over.
  const globals = deriveGlobalStates({
    isSpeedLocked: false,
    isSessionEnded: false,
    storage: "ok",
    update: "none",
    hasClockSkew: false,
    gps: "noFix",
    isBatteryLow: false,
    isOnline: true,
    isShiftOpen: true,
  });
  assert.deepEqual(
    globals.map((state) => state.cause),
    ["gpsNoFix"],
  );
});

void test("a fix from the quick read ends the search and the late timeout does nothing", async () => {
  const f = fixture();
  await f.source.start(f.publish);
  f.current[0]?.resolve(FIX);
  await Promise.resolve();
  await Promise.resolve();
  const ready = f.states.at(-1);
  assert.equal(ready?.kind, "granted");
  assert.deepEqual(locationStatus(ready as LocationState), { kind: "ready", accuracyM: 35 });
  const before = f.states.length;
  f.timers[0]?.run();
  assert.equal(f.states.length, before);
});

void test("a fix after noFix recovers to ready, and stopping removes watchers and timer", async () => {
  const f = fixture();
  const stop = await f.source.start(f.publish);
  f.timers[0]?.run();
  f.watchers[0]?.emit(FIX);
  assert.equal(f.states.at(-1)?.kind, "granted");
  stop();
  assert.ok(f.watchers.every((watcher) => watcher.removed));
  assert.ok(f.timers.every((timer) => timer.cancelled));
  const before = f.states.length;
  f.watchers[1]?.emit(FIX);
  assert.equal(f.states.length, before);
});

void test("services off and denied permission are reported once and nothing is watched", async () => {
  const off = fixture({ isServiceOn: false });
  await off.source.start(off.publish);
  assert.deepEqual(off.states, [{ kind: "off" }]);
  const denied = fixture({ isGranted: false });
  await denied.source.start(denied.publish);
  assert.deepEqual(denied.states, [{ kind: "denied" }]);
  assert.equal(off.watchers.length + denied.watchers.length, 0);
});
