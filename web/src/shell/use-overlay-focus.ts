import { useRef } from "react";
import { hasOpenModal } from "./modal-exclusion";
import { isShellSessionAvailable } from "./shell-session";
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
      event.preventDefault();
      if (!shouldRestore.current || !isShellSessionAvailable() || hasOpenModal()) return;
      if (opener.current?.isConnected) opener.current.focus();
    },
    skipRestore: () => {
      shouldRestore.current = false;
    },
  };
}
