import { useState } from "react";
import { STORAGE_KEYS, writeStored } from "../storage/safe-storage";
import { applyTheme, getInitialTheme } from "./theme";
import type { ThemePreference } from "./theme";

/** Keeps the selector's preference separate from the resolved light/dark appearance. */
export function useTheme() {
  const [preference, setPreference] = useState(getInitialTheme);
  return {
    preference,
    setPreference: (next: ThemePreference) => {
      applyTheme(next);
      setPreference(next);
      writeStored(STORAGE_KEYS.theme, next);
    },
  };
}
