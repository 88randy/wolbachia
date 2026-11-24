/** Why the app shows a global message, how much it blocks and what the courier does next. */
export type GlobalCause =
  | "speedLock"
  | "sessionEnded"
  | "storageFull"
  | "updateRequired"
  | "clockSkew"
  | "gpsOff"
  | "gpsDenied"
  | "gpsUnreliable"
  | "gpsSearching"
  | "gpsNoFix"
  | "storageLow"
  | "batteryLow"
  | "noSignal"
  | "updateAvailable";

/** `blocking` stops data entry; `warning` allows work with care; `info` only informs. */
export type BlockingLevel = "blocking" | "warning" | "info";

export type NextAction =
  | "stopMoving"
  | "signIn"
  | "freeSpace"
  | "installWhenSignal"
  | "keepWorkingReview"
  | "enableLocation"
  | "waitForFix"
  | "chargeOrSaveBattery"
  | "keepWorkingSaved"
  | "installWhenClosing";

export interface GlobalState {
  readonly cause: GlobalCause;
  readonly level: BlockingLevel;
  readonly nextAction: NextAction;
}

export type StorageLevel = "ok" | "low" | "full" | "unknown";
export type GpsLevel = "ok" | "off" | "denied" | "searching" | "noFix" | "unreliable" | "unknown";
export type UpdateLevel = "none" | "available" | "required";

export interface GlobalInputs {
  readonly isSpeedLocked: boolean;
  readonly isSessionEnded: boolean;
  readonly storage: StorageLevel;
  readonly update: UpdateLevel;
  readonly hasClockSkew: boolean;
  readonly gps: GpsLevel;
  readonly isBatteryLow: boolean;
  readonly isOnline: boolean;
  /** GPS is only needed with an open shift. */
  readonly isShiftOpen: boolean;
}

type Rule = readonly [(input: GlobalInputs) => boolean, GlobalState];

/** Highest priority first, so the same input always gives the same order. */
const RULES: readonly Rule[] = [
  [(i) => i.isSpeedLocked, state("speedLock", "blocking", "stopMoving")],
  [(i) => i.isSessionEnded, state("sessionEnded", "blocking", "signIn")],
  [(i) => i.storage === "full", state("storageFull", "blocking", "freeSpace")],
  [(i) => i.update === "required", state("updateRequired", "warning", "installWhenSignal")],
  [(i) => i.hasClockSkew, state("clockSkew", "warning", "keepWorkingReview")],
  [(i) => i.isShiftOpen && i.gps === "off", state("gpsOff", "warning", "enableLocation")],
  [(i) => i.isShiftOpen && i.gps === "denied", state("gpsDenied", "warning", "enableLocation")],
  [(i) => i.isShiftOpen && i.gps === "unreliable", state("gpsUnreliable", "info", "waitForFix")],
  [(i) => i.isShiftOpen && i.gps === "searching", state("gpsSearching", "info", "waitForFix")],
  [(i) => i.isShiftOpen && i.gps === "noFix", state("gpsNoFix", "info", "keepWorkingReview")],
  [(i) => i.storage === "low", state("storageLow", "warning", "freeSpace")],
  [(i) => i.isBatteryLow, state("batteryLow", "info", "chargeOrSaveBattery")],
  [(i) => !i.isOnline, state("noSignal", "info", "keepWorkingSaved")],
  [(i) => i.update === "available", state("updateAvailable", "info", "installWhenClosing")],
];

function state(cause: GlobalCause, level: BlockingLevel, nextAction: NextAction): GlobalState {
  return { cause, level, nextAction };
}

export function deriveGlobalStates(input: GlobalInputs): readonly GlobalState[] {
  return RULES.filter(([applies]) => applies(input)).map(([, found]) => found);
}

/** Informational GPS causes: the ones that come and go with each fix. */
export const GPS_INFO_CAUSES: readonly GlobalCause[] = [
  "gpsSearching",
  "gpsNoFix",
  "gpsUnreliable",
];

/**
 * [ASSUMPTION] Technical hysteresis, not a business rule: "searching"/"unreliable" must hold this
 * long (two 3 s fixes) before it shows, and "ok" this long before it clears.
 */
export const GPS_CALM_MS = 5000;
const SLOW_GPS: readonly GpsLevel[] = ["searching", "unreliable"];

interface CalmGpsDeps {
  readonly schedule: (run: () => void, ms: number) => () => void;
  readonly publish: (level: GpsLevel) => void;
}

/**
 * The GPS level the banner shows. One bad fix never shows "approximate" and one good fix never
 * clears it: a change to or from searching/unreliable only lands if it holds for GPS_CALM_MS.
 * Other levels (off, denied, noFix, ok after off) land at once.
 */
export class CalmGps {
  readonly #deps: CalmGpsDeps;
  #shown: GpsLevel = "ok";
  #target: GpsLevel = "ok";
  #cancel: (() => void) | null = null;
  constructor(deps: CalmGpsDeps) {
    this.#deps = deps;
  }
  set(level: GpsLevel): void {
    if (level === this.#target) return;
    this.#target = level;
    this.#cancel?.();
    this.#cancel = null;
    if (level === this.#shown) return;
    const isSlow = SLOW_GPS.includes(level) || (SLOW_GPS.includes(this.#shown) && level === "ok");
    if (!isSlow) {
      this.#show(level);
      return;
    }
    this.#cancel = this.#deps.schedule(() => {
      this.#cancel = null;
      this.#show(level);
    }, GPS_CALM_MS);
  }
  /** Drops a pending change; the next `set` arms it again (effects can unmount and remount). */
  stop(): void {
    this.#cancel?.();
    this.#cancel = null;
    this.#target = this.#shown;
  }
  #show(level: GpsLevel): void {
    this.#shown = level;
    this.#deps.publish(level);
  }
}

/**
 * Once a GPS banner has shown while location is watched, its slot stays reserved until the watch
 * ends, so the banner coming and going never moves the buttons under the courier's finger.
 */
export function keepsGpsSlot(
  wasReserved: boolean,
  hasGpsBanner: boolean,
  isWatching: boolean,
): boolean {
  return isWatching && (wasReserved || hasGpsBanner);
}
