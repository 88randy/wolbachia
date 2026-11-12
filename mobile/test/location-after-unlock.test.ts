import assert from "node:assert/strict";
import { test } from "node:test";
import type { LocationObject } from "expo-location";
import { createAndroidLocation } from "../src/features/day/create-android-location.ts";
import type { LocationState } from "../src/features/day/location.ts";
import { SharedLocationSource } from "../src/features/day/shared-location.ts";
import { subscribeLocation } from "../src/features/day/subscribe-location.ts";
import type { AppStatePort } from "../src/features/day/subscribe-location.ts";
import { ShiftLocationSource } from "../src/features/shift-close/location.ts";

const FIX: LocationObject = {
  coords: {
    latitude: 19.4,
    longitude: -99.1,
    altitude: null,
    accuracy: 30,
    altitudeAccuracy: null,
    heading: null,
    speed: 0,
  },
  timestamp: 1000,
};
const settle = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve();
};

/** The real chain (shift gate, shared watch, android source) over controlled native calls. */
function chain(options: { readonly hangsOnPermission?: boolean } = {}) {
  const calls = { watch: 0, removed: 0 };
  const emitters: ((fix: LocationObject) => void)[] = [];
  const timers: { run: () => void; cancelled: boolean }[] = [];
  const android = createAndroidLocation({
    api: {
      Accuracy: { Balanced: 3, High: 4 },
      hasServicesEnabledAsync: () => Promise.resolve(true),
      requestForegroundPermissionsAsync: () =>
        options.hangsOnPermission === true
          ? new Promise<{ granted: boolean }>(() => undefined)
          : Promise.resolve({ granted: true }),
      getLastKnownPositionAsync: () => Promise.resolve(null),
      getCurrentPositionAsync: () => new Promise<LocationObject>(() => undefined),
      watchPositionAsync: (_options: unknown, callback: (fix: LocationObject) => void) => {
        calls.watch++;
        emitters.push(callback);
        return Promise.resolve({
          remove: () => {
            calls.removed++;
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
  const shared = new SharedLocationSource({ source: android, schedule: () => () => undefined });
  const source = new ShiftLocationSource(shared, () => Promise.resolve(true));
  return { source, calls, emitters, timers };
}

function appPort() {
  const listeners = new Set<(state: string) => void>();
  const port: AppStatePort = {
    current: () => "active",
    onChange: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return { port, listeners };
}

/** What the safety monitor effect does: location is needed only when unlocked with an open shift. */
function mount(f: ReturnType<typeof chain>, isNeeded: boolean, states: LocationState[]) {
  return subscribeLocation({
    source: f.source,
    isNeeded,
    publish: (state) => {
      states.push(state);
    },
    app: appPort().port,
  });
}

void test("PIN then unlocked with an open shift: no watch before, exactly one after", async () => {
  const f = chain();
  const states: LocationState[] = [];
  // On the PIN screen location is not needed.
  const locked = mount(f, false, states);
  await settle();
  assert.equal(f.calls.watch, 0);
  assert.deepEqual(states, [{ kind: "unavailable" }]);
  // Unlock: the effect cleans up and runs again with location needed.
  locked();
  const unlocked = mount(f, true, states);
  await settle();
  assert.equal(f.calls.watch, 1);
  assert.equal(f.calls.removed, 0);
  assert.deepEqual(states.at(-1), { kind: "searching" });
  f.emitters[0]?.(FIX);
  assert.equal(states.at(-1)?.kind, "granted");
  unlocked();
});

void test("searching never lasts without a started watch: a hung native call ends in noFix", async () => {
  const f = chain({ hangsOnPermission: true });
  const states: LocationState[] = [];
  mount(f, true, states);
  await settle();
  // The wait was armed when the source started, not after the native calls answered.
  assert.equal(f.calls.watch, 0);
  assert.deepEqual(states.at(-1), { kind: "searching" });
  f.timers[0]?.run();
  assert.deepEqual(states.at(-1), { kind: "noFix" });
});

void test("location not needed (locked or no shift) never says searching", async () => {
  const f = chain();
  const states: LocationState[] = [];
  mount(f, false, states);
  await settle();
  assert.ok(states.every((state) => state.kind === "unavailable"));
  assert.equal(f.calls.watch, 0);
});
