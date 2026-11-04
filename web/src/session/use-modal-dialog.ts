import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Opens the `<dialog>` it is attached to as a MODAL while the component is mounted: the page
 * behind becomes inert, Tab stays inside, and the browser draws the backdrop. Focus goes to
 * `initialFocus` and returns to where it was when the dialog closes (WCAG 2.4.3).
 */
export function useModalDialog(initialFocus: string): RefObject<HTMLDialogElement | null> {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return undefined;
    const previous = document.activeElement;
    dialog.showModal();
    dialog.querySelector<HTMLElement>(initialFocus)?.focus();
    return () => {
      dialog.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [initialFocus]);
  return dialogRef;
}
