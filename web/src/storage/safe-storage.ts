/**
 * Per-viewer preferences kept in the browser (language, theme, sidebar). They are conveniences,
 * never the source of truth, so a blocked or full storage must not break the app.
 */

/** Storage keys, one place so nothing is spelled twice. */
export const STORAGE_KEYS = {
  language: "wolbachia.language",
  theme: "wolbachia.theme",
  sidebarCollapsed: "wolbachia.sidebarCollapsed",
} as const;

/** Returns the stored value, or null when absent or when storage is unavailable. */
export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn(`Could not read "${key}" from localStorage`, error);
    return null;
  }
}

/** Stores a value; a failure is logged and the preference simply is not remembered. */
export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Could not write "${key}" to localStorage`, error);
  }
}
