import * as Location from "expo-location";
import type { LocationSource, LocationState } from "./location.ts";
function fromNative(fix: Location.LocationObject): LocationState {
  return {
    kind: "granted",
    fix: {
      lat: fix.coords.latitude,
      lng: fix.coords.longitude,
      accuracy_m: fix.coords.accuracy,
      fixedAt: fix.timestamp,
    },
  };
}
/** Foreground fixes only. The caller stops this subscription on screen exit, background or closed shift. No pings. */
export const androidLocation: LocationSource = {
  async start(publish) {
    try {
      if (!(await Location.hasServicesEnabledAsync())) {
        publish({ kind: "unavailable" });
        return () => undefined;
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        publish({ kind: "denied" });
        return () => undefined;
      }
      const last = await Location.getLastKnownPositionAsync();
      if (last !== null) publish(fromNative(last));
      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced },
        (fix) => {
          publish(fromNative(fix));
        },
        () => {
          publish({ kind: "unavailable" });
        },
      );
      return () => {
        subscription.remove();
      };
    } catch {
      publish({ kind: "unavailable" });
      return () => undefined;
    }
  },
};
