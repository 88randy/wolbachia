import { useModalDialog } from "../session/use-modal-dialog";
/** Keep native close-watcher events from dismissing a modal during a write. */
export function useCatalogDialog(options: {
  initialFocus: string;
  isBusy: boolean;
  onCancel: () => void;
}) {
  const ref = useModalDialog(options.initialFocus);
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
