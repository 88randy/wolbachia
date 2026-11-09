import * as Location from "expo-location";
import type { IncidentGps } from "./types.ts";
import { currentLocation } from "../day/location.ts";

/** Never request permission, start tracking or wait for a new fix on the emergency Save path. */
export async function lastIncidentGps(): Promise<IncidentGps | null> {
  try {
    if (!(await Location.getForegroundPermissionsAsync()).granted) return null;
    const fix = await Location.getLastKnownPositionAsync();
    if (!fix) return null;
    const state = currentLocation(
      {
        kind: "granted",
        fix: {
          lat: fix.coords.latitude,
          lng: fix.coords.longitude,
          accuracy_m: fix.coords.accuracy,
          fixedAt: fix.timestamp,
        },
      },
      new Date(),
    );
    if (state.kind !== "granted" || fix.timestamp > Date.now()) return null;
    return {
      fix: { lat: state.fix.lat, lng: state.fix.lng, accuracy_m: state.fix.accuracy_m },
      fixedAt: fix.timestamp,
    };
  } catch {
    return null;
  }
}
