import { useEffect, useRef } from "react";
import type { SyntheticEvent } from "react";
import { useModalDialog } from "../session/use-modal-dialog";
export function fleetClearFocusId(owner: string, motorcycle: string, fault: string) {
  return `${owner}-clear-${motorcycle}-${fault}`;
}
interface ReturnFocus {
  openerId: string;
  fallbackId: string;
  isCurrent: () => boolean;
}
function useReturnFallback(focus?: ReturnFocus) {
  const currentOwner = useRef(focus?.isCurrent);
  currentOwner.current = focus?.isCurrent;
  const openerId = focus?.openerId;
  const fallbackId = focus?.fallbackId;
  useEffect(() => {
    const isCurrent = currentOwner.current;
    return () => {
      if (
        isCurrent?.() &&
        fallbackId &&
        openerId &&
        !document.getElementById(openerId) &&
        document.activeElement === document.body
      )
        document.getElementById(fallbackId)?.focus();
    };
  }, [fallbackId, openerId]);
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
