import { useEffect } from "react";
import type { RefObject } from "react";

interface DismissOptions {
  isOpen: boolean;
  /** Everything that counts as "inside": the button and the panel. */
  containerRef: RefObject<HTMLElement | null>;
  /** Called with `true` when Escape was pressed, so the caller can return focus to its button. */
  onDismiss: (viaEscape: boolean) => void;
}

/**
 * Closes a disclosure on Escape, on a pointer press outside it and when focus moves outside it
 * (Tab past the last item). Only listens while it is open.
 */
export function useDismiss({ isOpen, containerRef, onDismiss }: DismissOptions): void {
  useEffect(() => {
    if (!isOpen) return undefined;
    const isOutside = (target: EventTarget | null) =>
      target instanceof Node && containerRef.current?.contains(target) !== true;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss(true);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (isOutside(event.target)) onDismiss(false);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (isOutside(event.target)) onDismiss(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [isOpen, containerRef, onDismiss]);
}
