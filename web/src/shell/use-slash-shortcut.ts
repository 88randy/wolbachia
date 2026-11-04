import { useEffect } from "react";
import type { RefObject } from "react";

const TYPING_TAGS = ["INPUT", "TEXTAREA", "SELECT"];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || TYPING_TAGS.includes(target.tagName);
}

/** Pressing `/` outside a text field moves focus to the element, as the design's hint shows. */
export function useSlashShortcut(target: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const hasModifier = event.ctrlKey || event.metaKey || event.altKey;
      if (event.key !== "/" || hasModifier || isTypingTarget(event.target)) return;
      event.preventDefault();
      target.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [target]);
}
