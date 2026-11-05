import { useEffect } from "react";
import { useModalDialog } from "../session/use-modal-dialog";
/** Keep native close-watcher events from dismissing a modal during a write. */
export function useCatalogDialog(options: {
  initialFocus: string;
  isBusy: boolean;
  onCancel: () => void;
}) {
  const ref = useModalDialog(options.initialFocus);
  useEffect(
    () => () => {
      // A successful deactivation removes its opener from the active-only table.
      if (document.activeElement === document.body)
        document.querySelector<HTMLElement>("[data-catalog-include]")?.focus();
    },
    [],
  );
  const cancel = () => {
    if (!options.isBusy) options.onCancel();
  };
  const onClose = (dialog: HTMLDialogElement) => {
    if (!dialog.isConnected || dialog.open) return;
    if (!options.isBusy) {
      options.onCancel();
      return;
    }
    dialog.showModal();
    dialog.querySelector<HTMLElement>(options.initialFocus)?.focus();
  };
  return { ref, cancel, onClose };
}
