import * as Location from "expo-location";
import { createAndroidLocation } from "./create-android-location.ts";
import type { LocationSource } from "./location.ts";

export const androidLocation: LocationSource = createAndroidLocation({
  api: Location,
  schedule: (run, ms) => {
    const timer = setTimeout(run, ms);
    return () => {
      clearTimeout(timer);
    };
  },
});
