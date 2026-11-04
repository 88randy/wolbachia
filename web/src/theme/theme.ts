import { readStored, STORAGE_KEYS, writeStored } from "../storage/safe-storage";

export type ThemeName = "light" | "dark";

/** Light unless the user chose otherwise. The user setting itself comes with the session (#28). */
const DEFAULT_THEME: ThemeName = "light";

function isThemeName(value: unknown): value is ThemeName {
  return value === "light" || value === "dark";
}

export function getInitialTheme(): ThemeName {
  const stored = readStored(STORAGE_KEYS.theme);
  return isThemeName(stored) ? stored : DEFAULT_THEME;
}

/** `data-theme="dark"` on <html> switches every token variable (see packages/tokens). */
export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset["theme"] = theme;
}

/** Applies a theme and remembers it for the next visit. */
export function setTheme(theme: ThemeName): void {
  applyTheme(theme);
  writeStored(STORAGE_KEYS.theme, theme);
}
