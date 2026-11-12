import assert from "node:assert/strict";
import { test } from "node:test";
import type { LocationObject } from "expo-location";
import { createAndroidLocation } from "../src/features/day/create-android-location.ts";
import type { LocationState } from "../src/features/day/location.ts";
import { SharedLocationSource } from "../src/features/day/shared-location.ts";

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

/** Native calls are counted; nothing waits on a real clock. */
function fixture(overrides: { readonly isGranted?: boolean } = {}) {
  const calls = { watch: 0, removed: 0, watchOptions: [] as Record<string, unknown>[] };
  const emitters: ((fix: LocationObject) => void)[] = [];
  const graces: { run: () => void; cancelled: boolean }[] = [];
  const native = createAndroidLocation({
    api: {
      Accuracy: { Balanced: 3, High: 4 },
      hasServicesEnabledAsync: () => Promise.resolve(true),
      requestForegroundPermissionsAsync: () =>
        Promise.resolve({ granted: overrides.isGranted ?? true }),
      getLastKnownPositionAsync: () => Promise.resolve(null),
      getCurrentPositionAsync: () => new Promise<LocationObject>(() => undefined),
      watchPositionAsync: (
        options: Record<string, unknown>,
        callback: (fix: LocationObject) => void,
      ) => {
        calls.watch++;
        calls.watchOptions.push(options);
        emitters.push(callback);
        return Promise.resolve({
          remove: () => {
            calls.removed++;
          },
        });
      },
    } as never,
    schedule: () => () => undefined,
  });
  const shared = new SharedLocationSource({
    source: native,
    schedule: (run) => {
      const grace = { run, cancelled: false };
      graces.push(grace);
      return () => {
        grace.cancelled = true;
      };
    },
  });
  return { shared, calls, emitters, graces };
}
const settle = async () => {
  for (let index = 0; index < 8; index++) await Promise.resolve();
};

void test("flapping subscribers (re-renders, store emissions, shift flag) keep ONE native watch", async () => {
  const f = fixture();
  const seen: LocationState[] = [];
  // The safety monitor and the day screen both attach, then re-subscribe many times in a row.
  const stops: (() => void)[] = [];
  for (let round = 0; round < 25; round++) {
    const stop = await f.shared.start((state) => {
      seen.push(state);
    });
    stops.push(stop);
    await settle();
    // Each re-render drops the previous subscription, as an effect cleanup does.
    if (round > 0) stops[round - 1]?.();
  }
  f.emitters[0]?.(FIX);
  assert.equal(f.calls.watch, 1);
  assert.equal(f.calls.removed, 0);
  assert.equal(seen.at(-1)?.kind, "granted");
});

void test("the native watch uses a real interval, never as fast as possible and never High", async () => {
  const f = fixture();
  await f.shared.start(() => undefined);
  await settle();
  const [options] = f.calls.watchOptions;
  assert.equal(options?.accuracy, 3);
  assert.ok(typeof options?.timeInterval === "number" && options.timeInterval >= 1000);
});

void test("the watch is removed only after the last viewer leaves and the grace passes", async () => {
  const f = fixture();
  const stop = await f.shared.start(() => undefined);
  await settle();
  stop();
  assert.equal(f.calls.removed, 0);
  // Coming back inside the grace keeps the same watch.
  const again = await f.shared.start(() => undefined);
  await settle();
  assert.equal(f.graces[0]?.cancelled, true);
  assert.equal(f.calls.watch, 1);
  again();
  f.graces[1]?.run();
  await settle();
  assert.equal(f.calls.removed, 1);
  await f.shared.start(() => undefined);
  await settle();
  assert.equal(f.calls.watch, 2);
});

void test("a denied permission is tried again by the next viewer", async () => {
  const f = fixture({ isGranted: false });
  const seen: LocationState[] = [];
  await f.shared.start((state) => {
    seen.push(state);
  });
  await settle();
  assert.deepEqual(seen, [{ kind: "searching" }, { kind: "denied" }]);
  const next: LocationState[] = [];
  await f.shared.start((state) => {
    next.push(state);
  });
  await settle();
  assert.deepEqual(next, [{ kind: "searching" }, { kind: "denied" }]);
  assert.equal(f.calls.watch, 0);
});
