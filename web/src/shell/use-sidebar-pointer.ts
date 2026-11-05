import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import { clampSidebarWidth } from "./sidebar-size";

/** Pointer capture keeps dragging deterministic when the pointer leaves the thin edge. */
export function useSidebarPointer(width: number, onWidth: (next: number) => void) {
  const start = useRef<{ pointer: number; origin: number; width: number } | null>(null);
  const [isDragging, setDragging] = useState(false);
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { pointer: event.pointerId, origin: event.clientX, width };
    setDragging(true);
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = start.current;
    if (drag === null || drag.pointer !== event.pointerId) return;
    onWidth(clampSidebarWidth(drag.width + event.clientX - drag.origin));
  }
  function stop() {
    start.current = null;
    setDragging(false);
  }
  return {
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp: stop,
    onPointerCancel: stop,
    onLostPointerCapture: stop,
  };
}
