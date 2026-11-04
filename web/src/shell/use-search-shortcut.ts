import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Ctrl+K (Windows, Linux) or Cmd+K (Mac) focuses the element. A shortcut with a modifier key
 * cannot be triggered by accident while typing, so it satisfies WCAG 2.1.4 (a single
 * character key such as `/` would not).
 */
export function useSearchShortcut(target: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const hasCommandKey = event.ctrlKey || event.metaKey;
      if (event.key.toLowerCase() !== "k" || !hasCommandKey || event.altKey || event.shiftKey)
        return;
      event.preventDefault();
      target.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [target]);
}

/** Text of the shortcut hint shown inside the search field. */
export function searchShortcutHint(platform: string): string {
  return /mac|iphone|ipad/i.test(platform) ? "⌘K" : "Ctrl K";
}
