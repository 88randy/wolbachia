import { UserLocation } from "@maplibre/maplibre-react-native";
import { useLocationGranted } from "./use-location-granted.ts";

/** The courier's own dot with its accuracy halo, only once location is granted. */
export function MapUserLocation() {
  return useLocationGranted() ? <UserLocation accuracy /> : null;
}
