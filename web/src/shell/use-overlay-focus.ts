import { useRef } from "react";
/** Capture before Radix autofocus; navigation owns destination focus instead of restoring it. */
export function useOverlayFocus() {
  const opener = useRef<HTMLElement | null>(null);
  const shouldRestore = useRef(true);
  return {
    onOpenAutoFocus: () => {
      shouldRestore.current = true;
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    },
    onCloseAutoFocus: (event: Event) => {
      if (!shouldRestore.current) {
        event.preventDefault();
        return;
      }
      if (!opener.current?.isConnected) return;
      event.preventDefault();
      opener.current.focus();
    },
    skipRestore: () => {
      shouldRestore.current = false;
    },
  };
}
