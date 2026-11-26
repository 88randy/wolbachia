import { useEffect, useRef } from "react";
import type { SyntheticEvent } from "react";
import { useModalDialog } from "../session/use-modal-dialog";
export function fleetClearFocusId(owner: string, motorcycle: string, fault: string) {
  return `${owner}-clear-${motorcycle}-${fault}`;
}
interface ReturnFocus {
  openerId: string;
  isCurrent: () => boolean;
}
/** The record heading takes focus when the opener is gone (the actions live in the menu). */
function focusHeading() {
  const heading = document.querySelector<HTMLElement>("h1");
  heading?.setAttribute("tabindex", "-1");
  heading?.focus();
}
function useReturnFallback(focus?: ReturnFocus) {
  const currentOwner = useRef(focus?.isCurrent);
  currentOwner.current = focus?.isCurrent;
  const openerId = focus?.openerId;
  useEffect(() => {
    const isCurrent = currentOwner.current;
    return () => {
      if (
        isCurrent?.() &&
        openerId &&
        !document.getElementById(openerId) &&
        document.activeElement === document.body
      )
        focusHeading();
    };
  }, [openerId]);
}
/** Native modality starts on Cancel; return follows the current logical action, not an old cell. */
export function useFleetDialog(isBusy: boolean, onDismiss: () => void, focus?: ReturnFocus) {
  const ref = useModalDialog("[data-fleet-cancel]", focus?.openerId);
  useReturnFallback(focus);
  return {
    ref,
    onCancel: (event: SyntheticEvent<HTMLDialogElement>) => {
      event.preventDefault();
      if (!isBusy) onDismiss();
    },
    onClose: (event: SyntheticEvent<HTMLDialogElement>) => {
      const dialog = event.currentTarget;
      if (!dialog.isConnected || dialog.open) return;
      if (!isBusy) onDismiss();
      else {
        dialog.showModal();
        dialog.querySelector<HTMLElement>("[data-fleet-cancel]")?.focus();
      }
    },
  };
}
