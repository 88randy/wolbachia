import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { INITIAL_SAFETY, observeSafety, readSafetyRules } from "../src/features/safety/domain.ts";
import type { SafetyRules, SafetySample, SafetyState } from "../src/features/safety/domain.ts";
import { causeKey, levelKey, nextKey } from "../src/features/safety/copy.ts";
import { deriveGlobalStates } from "../src/features/safety/global-state.ts";
import type { GlobalInputs } from "../src/features/safety/global-state.ts";
import { createTranslate, isMessageKey } from "../src/i18n/translate.ts";
import { deriveStorageLevel } from "../src/features/safety/storage-level.ts";

const T0 = 1_000_000;
const RULES: SafetyRules = { lockKmh: 10, unlockSeconds: 5, unlockKmh: 3, maxAccuracyM: 50 };
const kmh = (value: number) => value / 3.6;

function fix(atMs: number, speedKmh: number | null, accuracyM: number | null = 8): SafetySample {
  return { atMs, speedMps: speedKmh === null ? null : kmh(speedKmh), accuracyM };
}

/** Fake clock: the trace is a list of [seconds, sample]; the phone clock is the fix time. */
function run(trace: readonly (readonly [number, SafetySample | null])[], from = INITIAL_SAFETY) {
  return trace.reduce<SafetyState>(
    (state, [seconds, sample]) =>
      observeSafety({ state, sample, nowMs: T0 + seconds * 1000, rules: RULES }),
    from,
  );
}

const LOCKED = run([[0, fix(T0, 20)]]);

void describe("speed lock hysteresis", () => {
  void it("locks at the configured speed and not below it", () => {
    assert.equal(run([[0, fix(T0, 9.9)]]).lockCause, null);
    assert.equal(run([[0, fix(T0, 10)]]).lockCause, "speed");
  });

  void it("unlocks only after the interval of fresh fixes below the unlock speed", () => {
    const stopped = (seconds: number) => fix(T0 + seconds * 1000, 1);
    assert.equal(
      run(
        [
          [1, stopped(1)],
          [5, stopped(5)],
        ],
        LOCKED,
      ).lockCause,
      "speed",
    );
    assert.equal(
      run(
        [
          [1, stopped(1)],
          [6, stopped(6)],
        ],
        LOCKED,
      ).lockCause,
      null,
    );
  });

  void it("a speed between unlock and lock restarts the interval", () => {
    const state = run(
      [
        [1, fix(T0 + 1000, 1)],
        [4, fix(T0 + 4000, 5)],
        [7, fix(T0 + 7000, 1)],
        [11, fix(T0 + 11_000, 1)],
      ],
      LOCKED,
    );
    assert.equal(state.lockCause, "speed");
  });

  void it("missing and stale fixes reset the interval and never count as stopped", () => {
    const afterGap = run(
      [
        [1, fix(T0 + 1000, 1)],
        [4, null],
        [7, fix(T0 + 7000, 1)],
      ],
      LOCKED,
    );
    assert.equal(afterGap.lockCause, "speed");
    assert.equal(afterGap.lowSpeedSinceMs, T0 + 7000);
    const stale = run(
      [
        [1, fix(T0 + 1000, 1)],
        [100, fix(T0 + 1000, 1)],
      ],
      LOCKED,
    );
    assert.equal(stale.quality, "stale");
    assert.equal(stale.lowSpeedSinceMs, null);
    assert.equal(stale.lockCause, "speed");
  });

  void it("poor accuracy and unknown speed are explicit and never lock or unlock", () => {
    assert.equal(run([[0, fix(T0, 30, 500)]]).quality, "poorAccuracy");
    assert.equal(run([[0, fix(T0, 30, 500)]]).lockCause, null);
    assert.equal(run([[0, fix(T0, null)]]).quality, "unknownSpeed");
    assert.equal(run([[6, fix(T0 + 6000, 1, 500)]], LOCKED).lockCause, "speed");
  });

  void it("a gap between low-speed fixes longer than the freshness window restarts the interval", () => {
    const state = run(
      [
        [1, fix(T0 + 1000, 1)],
        [90, fix(T0 + 90_000, 1)],
      ],
      LOCKED,
    );
    assert.equal(state.lockCause, "speed");
    assert.equal(state.lowSpeedSinceMs, T0 + 90_000);
  });
});

void describe("safety rules from the snapshot", () => {
  const snapshot = (parameters: Record<string, number>) => ({
    version: "v1",
    next_change_at: null,
    parameters: Object.entries(parameters).map(([key, value]) => ({ key, value })),
  });

  void it("uses defaults without a snapshot and clamps to the allowed ranges", () => {
    assert.deepEqual(readSafetyRules(null), { ...RULES, maxAccuracyM: null });
    const clamped = readSafetyRules(
      snapshot({ speed_lock_kmh: 99, speed_unlock_seconds: 1 }) as never,
    );
    assert.equal(clamped.lockKmh, 15);
    assert.equal(clamped.unlockSeconds, 3);
  });

  void it("keeps lock above unlock even when the snapshot says otherwise", () => {
    const rules = readSafetyRules(snapshot({ speed_lock_kmh: 5, unlock_speed_kmh: 9 }) as never);
    assert.ok(rules.lockKmh > rules.unlockKmh);
  });
});

const CALM: GlobalInputs = {
  isSpeedLocked: false,
  isSessionEnded: false,
  storage: "ok",
  update: "none",
  hasClockSkew: false,
  gps: "ok",
  isBatteryLow: false,
  isOnline: true,
  isShiftOpen: true,
};

void describe("global states: cause, blocking level and next action", () => {
  void it("has no state when everything is fine", () => {
    assert.deepEqual(deriveGlobalStates(CALM), []);
  });

  void it("gives every failure a cause, a level and a usable next action", () => {
    const cases: readonly [Partial<GlobalInputs>, string, string, string][] = [
      [{ isSpeedLocked: true }, "speedLock", "blocking", "stopMoving"],
      [{ isSessionEnded: true }, "sessionEnded", "blocking", "signIn"],
      [{ storage: "full" }, "storageFull", "blocking", "freeSpace"],
      [{ storage: "low" }, "storageLow", "warning", "freeSpace"],
      [{ update: "required" }, "updateRequired", "warning", "installWhenSignal"],
      [{ update: "available" }, "updateAvailable", "info", "installWhenClosing"],
      [{ hasClockSkew: true }, "clockSkew", "warning", "keepWorkingReview"],
      [{ gps: "off" }, "gpsOff", "warning", "enableLocation"],
      [{ gps: "denied" }, "gpsDenied", "warning", "enableLocation"],
      [{ gps: "unreliable" }, "gpsUnreliable", "info", "waitForFix"],
      [{ isBatteryLow: true }, "batteryLow", "info", "chargeOrSaveBattery"],
      [{ isOnline: false }, "noSignal", "info", "keepWorkingSaved"],
    ];
    for (const [change, cause, level, nextAction] of cases)
      assert.deepEqual(deriveGlobalStates({ ...CALM, ...change }), [{ cause, level, nextAction }]);
  });

  void it("no signal is not no GPS, and GPS only matters with an open shift", () => {
    const offline = deriveGlobalStates({ ...CALM, isOnline: false });
    assert.deepEqual(
      offline.map((state) => state.cause),
      ["noSignal"],
    );
    assert.deepEqual(deriveGlobalStates({ ...CALM, gps: "off", isShiftOpen: false }), []);
  });

  void it("puts blocking states first", () => {
    const states = deriveGlobalStates({ ...CALM, isOnline: false, storage: "full", gps: "off" });
    assert.deepEqual(
      states.map((state) => state.cause),
      ["storageFull", "gpsOff", "noSignal"],
    );
  });
});

void describe("storage level", () => {
  void it("reports full or low from free bytes, and unknown when it cannot be read", () => {
    assert.equal(deriveStorageLevel(5 * 1024 * 1024), "full");
    assert.equal(deriveStorageLevel(100 * 1024 * 1024), "low");
    assert.equal(deriveStorageLevel(5 * 1024 * 1024 * 1024), "ok");
    assert.equal(deriveStorageLevel(null), "unknown");
    assert.equal(deriveStorageLevel(Number.NaN), "unknown");
  });
});

void describe("global state copy", () => {
  void it("every cause, level and next action has text in es-MX and en", () => {
    const all = deriveGlobalStates({
      isSpeedLocked: true,
      isSessionEnded: true,
      storage: "full",
      update: "required",
      hasClockSkew: true,
      gps: "off",
      isBatteryLow: true,
      isOnline: false,
      isShiftOpen: true,
    }).concat(
      deriveGlobalStates({ ...CALM, storage: "low", gps: "denied", update: "available" }),
      deriveGlobalStates({ ...CALM, gps: "unreliable" }),
    );
    assert.equal(all.length, 12);
    const keys = all.flatMap((state) => [
      causeKey(state.cause),
      nextKey(state.nextAction),
      levelKey(state.level),
    ]);
    for (const locale of ["es-MX", "en"] as const)
      for (const key of keys) {
        assert.ok(isMessageKey(key), key);
        assert.notEqual(createTranslate(locale)(key), key);
      }
  });
});
