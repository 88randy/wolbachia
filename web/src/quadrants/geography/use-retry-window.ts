import { useEffect, useState } from "react";
/** Retry-After only unlocks the button; it never sends or replays a request. */
export function useRetryWindow(retryAt: number): boolean {
  const [, setNow] = useState(Date.now);
  useEffect(() => {
    if (retryAt <= Date.now()) return;
    const timer = window.setTimeout(() => {
      setNow(Date.now());
    }, retryAt - Date.now());
    return () => {
      window.clearTimeout(timer);
    };
  }, [retryAt]);
  return retryAt > Date.now();
}
