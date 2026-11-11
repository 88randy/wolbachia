import { useEffect, useState } from "react";
import { AppState } from "react-native";
import type { LocationSource, LocationState } from "./location.ts";
/** A generation cancels late permission/watch promises when the app backgrounds or the screen unmounts. */
export function useDayLocation(
  source: LocationSource,
  isShiftOpen: boolean,
  recheck = 0,
): LocationState {
  const [state, setState] = useState<LocationState>({ kind: "unavailable" });
  useEffect(
    () => subscribeLocation({ source, isShiftOpen, publish: setState }),
    // `recheck` restarts the source so a new permission or setting is read at once.
    [source, isShiftOpen, recheck],
  );
  return state;
}
interface LocationSubscriptionInput {
  readonly source: LocationSource;
  readonly isShiftOpen: boolean;
  readonly publish: (state: LocationState) => void;
}
function subscribeLocation({ source, isShiftOpen, publish }: LocationSubscriptionInput) {
  let generation = 0;
  let stop: (() => void) | undefined;
  const update = () => {
    const current = ++generation;
    stop?.();
    stop = undefined;
    // Keep the last known state while the check repeats; resetting it made the banner blink.
    if (!isShiftOpen) {
      publish({ kind: "unavailable" });
      return;
    }
    if (AppState.currentState !== "active") return;
    void source
      .start((fix) => {
        if (current === generation) publish(fix);
      })
      .then((cancel) => {
        if (current !== generation) cancel();
        else stop = cancel;
      })
      .catch(() => {
        if (current === generation) publish({ kind: "unavailable" });
      });
  };
  update();
  const subscription = AppState.addEventListener("change", update);
  return () => {
    generation += 1;
    stop?.();
    subscription.remove();
  };
}
