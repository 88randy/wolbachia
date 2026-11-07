import { useEffect } from "react";
import type { SyntheticEvent } from "react";
import { useModalDialog } from "../session/use-modal-dialog";
/** Native modality starts on Cancel; busy requests cannot close or escape the dialog. */
export function useFleetDialog(isBusy: boolean, onDismiss: () => void, fallbackId?: string) {
  const ref = useModalDialog("[data-fleet-cancel]");
  useEffect(
    () => () => {
      if (fallbackId && document.activeElement === document.body)
        document.getElementById(fallbackId)?.focus();
    },
    [fallbackId],
  );
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
