import { useEffect, useRef } from "react";
import { createAnnotationActiveTime } from "./annotation-active-time";

export function useAnnotationActiveTime() {
  const timer = useRef<ReturnType<typeof createAnnotationActiveTime> | undefined>(undefined);
  useEffect(() => {
    const interact = () => timer.current?.interact();
    const visibility = () => timer.current?.visibility();
    const events = ["pointerdown", "pointermove", "keydown", "wheel"] as const;
    for (const event of events) window.addEventListener(event, interact, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    return () => {
      for (const event of events) window.removeEventListener(event, interact);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return {
    start: () => {
      timer.current = createAnnotationActiveTime();
      timer.current.interact();
    },
    read: () => timer.current?.read() ?? 0,
  };
}
