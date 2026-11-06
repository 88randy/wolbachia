import { applyResolvedTheme } from "./resolved-theme";
import { readStored, STORAGE_KEYS } from "../storage/safe-storage";

export type ThemeName = "light" | "dark";
export type ThemePreference = ThemeName | "system";

const DEFAULT_THEME: ThemePreference = "system";
const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";
let stopFollowingSystem: (() => void) | undefined;

/** Validates browser preferences and native selector values at the boundary. */
export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/** Restores a saved preference; absent, invalid or unavailable storage defaults to System. */
export function getInitialTheme(): ThemePreference {
  const stored = readStored(STORAGE_KEYS.theme);
  return isThemePreference(stored) ? stored : DEFAULT_THEME;
}

/**
 * Applies the preference before rendering; only resolved light/dark values reach the tokens.
 * System follows prefers-color-scheme, falling back to Light when matchMedia is unavailable.
 * Exactly one system listener can exist. Replacing the preference removes it first, so an
 * explicit choice cannot be overwritten by a later system change. Storage is not changed here.
 */
export function applyTheme(preference: ThemePreference): void {
  stopFollowingSystem?.();
  stopFollowingSystem = undefined;
  if (preference !== "system" || typeof window.matchMedia !== "function") {
    applyResolvedTheme(preference === "dark" ? "dark" : "light");
    return;
  }
  const query = window.matchMedia(DARK_SCHEME_QUERY);
  const updateTheme = () => {
    applyResolvedTheme(query.matches ? "dark" : "light");
  };
  query.addEventListener("change", updateTheme);
  stopFollowingSystem = () => {
    query.removeEventListener("change", updateTheme);
  };
  updateTheme();
}
