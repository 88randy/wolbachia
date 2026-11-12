import type { MessageKey } from "@wolbachia/i18n";
import type { TranslateParams } from "../../i18n/translate.ts";
import type { LocationState } from "./location.ts";
interface Message {
  readonly key: MessageKey;
  readonly params?: TranslateParams;
}
/** A weak verdict is possible only with a saved rule; display freshness independently from upload pings. */
export function locationMessage(input: {
  readonly state: LocationState;
  readonly now: Date;
  readonly maxAccuracyM: number | null;
}): Message {
  const { state, now, maxAccuracyM } = input;
  if (state.kind === "denied") return { key: "mobile.day.locationDenied" };
  if (state.kind === "off" || state.kind === "unavailable")
    return { key: "mobile.day.locationUnavailable" };
  if (state.kind === "noFix") return { key: "mobile.day.locationNoFix" };
  if (state.kind === "searching") return { key: "mobile.day.locationSearching" };
  const seconds = Math.max(0, Math.floor((now.getTime() - state.fix.fixedAt) / 1000));
  if (state.kind === "stale") return { key: "mobile.day.locationStale", params: { seconds } };
  const accuracy = state.fix.accuracy_m;
  if (accuracy === null) return { key: "mobile.day.locationUnknownAccuracy", params: { seconds } };
  const isWeak = maxAccuracyM !== null && accuracy > maxAccuracyM;
  return {
    key: isWeak ? "mobile.day.locationWeak" : "mobile.day.locationFix",
    params: { seconds, accuracy: Math.round(accuracy) },
  };
}
