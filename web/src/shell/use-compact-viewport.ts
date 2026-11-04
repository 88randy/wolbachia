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
 * True below `web.layout.compactBreakpoint`. The sidebar then stays at 64 px so the page keeps
 * room to reflow at 320 CSS px (WCAG 1.4.10). The breakpoint is read from the tokens in
 * TypeScript because a CSS media query cannot use a custom property.
 */
export function useCompactViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
