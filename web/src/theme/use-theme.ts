import { useContext, useEffect, useState } from "react";
import { STORAGE_KEYS, writeStored } from "../storage/safe-storage";
import { applyTheme, getInitialTheme, isThemePreference } from "./theme";
import type { ThemePreference } from "./theme";
import { ThemePreferenceContext } from "./preference-context";
const THEME_EVENT = "wolbachia:theme-preference";
/** Keep footer and top selector synchronized; System remains a distinct preference. */
export function useTheme() {
  const initialPreference = useContext(ThemePreferenceContext);
  const [preference, setState] = useState(() => initialPreference ?? getInitialTheme());
  useEffect(() => {
    function changed(event: Event) {
      if (event instanceof CustomEvent && isThemePreference(event.detail)) setState(event.detail);
    }
    window.addEventListener(THEME_EVENT, changed);
    return () => {
      window.removeEventListener(THEME_EVENT, changed);
    };
  }, []);
  return {
    preference,
    setPreference: (next: ThemePreference) => {
      applyTheme(next);
      setState(next);
      writeStored(STORAGE_KEYS.theme, next);
      window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
    },
  };
}
