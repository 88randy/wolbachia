import type { ThemeName } from "./theme";
export const RESOLVED_THEME_EVENT = "wolbachia:resolved-theme";

/** The DOM is resolved before rendering; the switch follows the actual appearance. */
export function getResolvedTheme(): ThemeName {
  return document.documentElement.dataset["theme"] === "dark" ? "dark" : "light";
}

/** System media changes and explicit choices use the same published appearance. */
export function applyResolvedTheme(theme: ThemeName): void {
  document.documentElement.dataset["theme"] = theme;
  window.dispatchEvent(new Event(RESOLVED_THEME_EVENT));
}

export function subscribeToResolvedTheme(onChange: () => void): () => void {
  window.addEventListener(RESOLVED_THEME_EVENT, onChange);
  return () => {
    window.removeEventListener(RESOLVED_THEME_EVENT, onChange);
  };
}
