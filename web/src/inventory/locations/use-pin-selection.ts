import { useCallback, useEffect, useRef, useState } from "react";

/**
 * One open popup at a time. Esc closes it from anywhere and hands focus back to the pin that
 * opened it (keyboard Enter or pointer click alike).
 */
export function usePinSelection() {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const trigger = useRef<HTMLElement | null>(null);

  const open = useCallback((key: string, element: HTMLElement) => {
    trigger.current = element;
    setSelectedKey(key);
  }, []);

  const close = useCallback((returnFocus: boolean) => {
    setSelectedKey(null);
    if (returnFocus) trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (selectedKey === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedKey, close]);

  return { selectedKey, open, close };
}
