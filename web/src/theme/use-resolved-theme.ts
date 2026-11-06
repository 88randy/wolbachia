import { useSyncExternalStore } from "react";
import { getResolvedTheme, subscribeToResolvedTheme } from "./resolved-theme";

/** React observes both live System changes and explicit preference changes. */
export function useResolvedTheme() {
  return useSyncExternalStore(subscribeToResolvedTheme, getResolvedTheme);
}
