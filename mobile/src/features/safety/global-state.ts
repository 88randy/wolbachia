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
export type GpsLevel = "ok" | "off" | "denied" | "searching" | "unreliable" | "unknown";
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
