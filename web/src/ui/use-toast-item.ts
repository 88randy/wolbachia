import { useCallback, useRef, useState } from "react";
import type { FocusEvent } from "react";
import type { ToastEntry } from "./toast-context";
import { useToastTimer } from "./use-toast-timer";
/** Each action can run once; interaction pauses only this toast's remaining lifetime. */
export function useToastItem(toast: ToastEntry, onDismiss: (id: number) => void) {
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const hasActed = useRef(false);
  const expire = useCallback(() => {
    onDismiss(toast.id);
  }, [onDismiss, toast.id]);
  useToastTimer(isHovered || hasFocus, expire);
  function runAction() {
    if (hasActed.current) return;
    hasActed.current = true;
    expire();
    toast.action?.onAction();
  }
  const events = {
    onMouseEnter: () => {
      setIsHovered(true);
    },
    onMouseLeave: () => {
      setIsHovered(false);
    },
    onFocusCapture: () => {
      setHasFocus(true);
    },
    onBlurCapture: (event: FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false);
    },
  };
  return { expire, runAction, events };
}
