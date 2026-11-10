import { useState } from "react";

/** Open/close of a dialog owned by a screen; the dialog itself returns focus when it closes. */
export function useOpenState() {
  const [isOpen, setOpen] = useState(false);
  return {
    isOpen,
    open: () => {
      setOpen(true);
    },
    close: () => {
      setOpen(false);
    },
  };
}
