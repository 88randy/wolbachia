import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Paths } from "expo-file-system";

import { useServices } from "../../app/services-context.ts";
import { isRulesSnapshot } from "../../auth/rules-snapshot.ts";
import { useSyncSnapshot } from "../../sync/use-sync.ts";
import { currentLocation } from "../day/location.ts";
import type { LocationState } from "../day/location.ts";
import { maxGpsAccuracy } from "../day/location.ts";
import { useDayLocation } from "../day/use-day-location.ts";
import { INITIAL_SAFETY, isSameSafety, observeSafety, readSafetyRules } from "./domain.ts";
import type { SafetyRules, SafetySample, SafetyState } from "./domain.ts";
import { deriveGlobalStates } from "./global-state.ts";
import type { GlobalState, GpsLevel, StorageLevel } from "./global-state.ts";
import { deriveStorageLevel } from "./storage-level.ts";

const TICK_MS = 1000;
const STORAGE_POLL_MS = 60_000;
const RULES_KEY = "auth_rules_snapshot";

export interface M16Model {
  readonly safety: SafetyState;
  readonly rules: SafetyRules;
  readonly globals: readonly GlobalState[];
  readonly isSpeedLocked: boolean;
  /** The one location stream of the app; capture steps read it instead of opening their own. */
  readonly location: LocationState;
  /** Reads the location setting again now (after a permission prompt or a trip to settings). */
  readonly recheckLocation: () => void;
}

function useRecheck(): readonly [number, () => void] {
  const [count, setCount] = useState(0);
  const recheck = useCallback(() => {
    setCount((value) => value + 1);
  }, []);
  return [count, recheck];
}

/** One local fix stream feeds the lock; it is independent from the upload ping cadence. */
export function useM16(): M16Model {
  const { auth, day } = useServices();
  const sync = useSyncSnapshot();
  const session = useSyncExternalStore(auth.subscribe, auth.getSnapshot);
  const rules = useSafetyRules(sync.lastSyncAt);
  const isShiftOpen = useShiftOpen(sync.lastSyncAt);
  const [recheck, recheckLocation] = useRecheck();
  const location = useDayLocation(day.location, isShiftOpen, recheck);
  const safety = useSafetyState(location, rules);
  const storage = useStorageLevel();
  const gps = useCalmGps(gpsLevel(location, safety));
  const isOnline = useCalmOnline(sync.isOnline);
  const globals = useMemo(
    () =>
      deriveGlobalStates({
        isSpeedLocked: safety.lockCause !== null,
        isSessionEnded: session.phase === "login",
        storage,
        // [ASSUMPTION] Battery and update sources arrive with the native adapters of M-17.
        update: "none",
        hasClockSkew: session.hasClockSkew,
        gps,
        isBatteryLow: false,
        isOnline,
        isShiftOpen,
      }),
    [safety, session.phase, session.hasClockSkew, storage, gps, isOnline, isShiftOpen],
  );
  return {
    safety,
    rules,
    globals,
    isSpeedLocked: safety.lockCause !== null,
    location,
    recheckLocation,
  };
}

/** "Looking for your location" only shows after a few seconds without a fix, never at startup. */
const SEARCH_GRACE_MS = 5000;
function useCalmGps(level: GpsLevel): GpsLevel {
  const [shown, setShown] = useState<GpsLevel>("ok");
  useEffect(() => {
    if (level !== "searching" && level !== "unreliable") {
      setShown(level);
      return undefined;
    }
    const timer = setTimeout(() => {
      setShown(level);
    }, SEARCH_GRACE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [level]);
  return shown;
}

/**
 * The connection reading flips at startup (unknown, then online) and on weak wifi. "No signal"
 * only shows after a few seconds without it, so the lock and PIN screens do not jump.
 */
const OFFLINE_GRACE_MS = 3000;
function useCalmOnline(isOnline: boolean): boolean {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    if (isOnline) {
      setShown(true);
      return undefined;
    }
    const timer = setTimeout(() => {
      setShown(false);
    }, OFFLINE_GRACE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [isOnline]);
  return shown;
}

function gpsLevel(location: LocationState, safety: SafetyState): GpsLevel {
  if (location.kind === "denied") return "denied";
  if (location.kind === "off") return "off";
  if (location.kind === "searching") return "searching";
  if (location.kind === "noFix") return "noFix";
  return safety.quality === "usable" ? "ok" : "unreliable";
}

function sampleOf(location: LocationState, nowMs: number): SafetySample | null {
  const current = currentLocation(location, new Date(nowMs));
  if (current.kind !== "granted" && current.kind !== "stale") return null;
  return {
    atMs: current.fix.fixedAt,
    // A negative platform speed means "unknown", not "stopped".
    speedMps: current.fix.speed_mps ?? null,
    accuracyM: current.fix.accuracy_m,
  };
}

function useSafetyState(location: LocationState, rules: SafetyRules): SafetyState {
  const [state, setState] = useState<SafetyState>(INITIAL_SAFETY);
  useEffect(() => {
    const step = () => {
      const nowMs = Date.now();
      setState((previous) => {
        const next = observeSafety({
          state: previous,
          sample: sampleOf(location, nowMs),
          nowMs,
          rules,
        });
        return isSameSafety(previous, next) ? previous : next;
      });
    };
    step();
    const timer = setInterval(step, TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, [location, rules]);
  return state;
}

function useSafetyRules(lastSyncAt: string | null): SafetyRules {
  const { kv, day } = useServices();
  const [rules, setRules] = useState<SafetyRules>(() => readSafetyRules(null));
  useEffect(() => {
    let isCurrent = true;
    void Promise.all([kv.get(RULES_KEY), day.read()]).then(([raw, read]) => {
      const parsed: unknown = raw === null ? null : JSON.parse(raw);
      if (!isCurrent) return;
      setRules(
        readSafetyRules(
          isRulesSnapshot(parsed) ? parsed : null,
          maxGpsAccuracy(parsed) ?? read.maxGpsAccuracyM,
        ),
      );
    });
    return () => {
      isCurrent = false;
    };
  }, [kv, day, lastSyncAt]);
  return rules;
}

function useShiftOpen(lastSyncAt: string | null): boolean {
  const { day } = useServices();
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    let isCurrent = true;
    void day.read().then((read) => {
      if (isCurrent) setIsOpen(read.isShiftOpen);
    });
    return () => {
      isCurrent = false;
    };
  }, [day, lastSyncAt]);
  return isOpen;
}

function useStorageLevel(): StorageLevel {
  const [level, setLevel] = useState<StorageLevel>("unknown");
  useEffect(() => {
    const read = () => {
      try {
        setLevel(deriveStorageLevel(Paths.availableDiskSpace));
      } catch {
        setLevel("unknown");
      }
    };
    read();
    const timer = setInterval(read, STORAGE_POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return level;
}
