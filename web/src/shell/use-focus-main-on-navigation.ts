import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { MAIN_ID } from "./ids";

/**
 * A single-page app does not reload, so after a navigation keyboard and screen-reader users
 * would stay on the link they pressed. Moves focus to <main> when the path changes (not on
 * the first load).
 */
export function useFocusMainOnNavigation(): void {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    document.getElementById(MAIN_ID)?.focus();
  }, [pathname]);
}
