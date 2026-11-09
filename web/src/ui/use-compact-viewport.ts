import { web } from "@wolbachia/tokens";
import { useSyncExternalStore } from "react";

const COMPACT_QUERY = `(max-width: ${String(web.layout.compactBreakpoint)}px)`;

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(COMPACT_QUERY);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

function getSnapshot(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(COMPACT_QUERY).matches;
}

/**
 * True below `web.layout.compactBreakpoint`, shared by the shell, breadcrumbs and dialog actions.
 * Reading the token in TypeScript avoids a second hard-coded CSS breakpoint and preserves
 * consistent reflow at 320 CSS px (WCAG 1.4.10).
 */
export function useCompactViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
