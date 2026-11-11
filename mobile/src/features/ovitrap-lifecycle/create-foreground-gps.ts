import { AppState } from "react-native";
import type { LocationSource } from "../day/location.ts";
import { ForegroundLifecycleGps } from "./foreground-gps.ts";

/** One foreground-only GPS reader over the shift location source; it stops when the app leaves the foreground. */
export function createForegroundGps(source: LocationSource): ForegroundLifecycleGps {
  return new ForegroundLifecycleGps({
    source,
    now: () => new Date(),
    activity: {
      isActive: () => AppState.currentState === "active",
      subscribe: (listener) => {
        const subscription = AppState.addEventListener("change", listener);
        return () => {
          subscription.remove();
        };
      },
    },
    schedule: (callback, delay) => {
      const timer = setTimeout(callback, delay);
      return () => {
        clearTimeout(timer);
      };
    },
  });
}
