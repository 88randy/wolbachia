import * as Location from "expo-location";
import { useEffect, useState } from "react";

/** True once foreground location is already granted; never prompts (the day flow owns that). */
export function useLocationGranted(): boolean {
  const [granted, setGranted] = useState(false);
  useEffect(() => {
    let active = true;
    Location.getForegroundPermissionsAsync()
      .then((result) => {
        if (active) setGranted(result.granted);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return granted;
}
