import { useEffect, useState } from "react";
import { AppState } from "react-native";
import type { LocationSource, LocationState } from "./location.ts";
import { subscribeLocation } from "./subscribe-location.ts";
import type { AppStatePort } from "./subscribe-location.ts";

const APP: AppStatePort = {
  // A reading that is not there yet (null before the first event) is not proof of background.
  current: () => AppState.currentState ?? "active",
  onChange: (listener) => {
    const subscription = AppState.addEventListener("change", listener);
    return () => {
      subscription.remove();
    };
  },
};

/**
 * The state starts as "unavailable" (no banner): "searching" is published only by a source that
 * has actually started, so the screen never says it is searching with nothing looking.
 */
export function useDayLocation(
  source: LocationSource,
  isNeeded: boolean,
  recheck = 0,
): LocationState {
  const [state, setState] = useState<LocationState>({ kind: "unavailable" });
  useEffect(
    () => subscribeLocation({ source, isNeeded, publish: setState, app: APP }),
    // `recheck` restarts the source so a new permission or setting is read at once.
    [source, isNeeded, recheck],
  );
  return state;
}
