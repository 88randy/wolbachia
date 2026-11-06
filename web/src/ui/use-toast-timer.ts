import { useEffect, useRef } from "react";
export const TOAST_DURATION_MS = 5000;
/** Hover and keyboard focus preserve the remaining action time instead of restarting it. */
export function useToastTimer(isPaused: boolean, onExpire: () => void) {
  const remaining = useRef(TOAST_DURATION_MS);
  useEffect(() => {
    if (isPaused) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(onExpire, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [isPaused, onExpire]);
}
