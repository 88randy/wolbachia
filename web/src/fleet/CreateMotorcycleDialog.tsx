import { useId } from "react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useModalDialog } from "../session/use-modal-dialog";
import dialog from "../void/void-dialog.module.css";
import styles from "./fleet.module.css";
import { CreateMotorcycleForm } from "./CreateMotorcycleForm";
import { useCreateMotorcycle } from "./use-create-motorcycle";
function handleClose(dialog: HTMLDialogElement, isBusy: boolean, onClose: () => void) {
  if (!dialog.isConnected || dialog.open) return;
  if (!isBusy) {
    onClose();
    return;
  }
  dialog.showModal();
  dialog.querySelector("input")?.focus();
}

interface Props {
  onClose: () => void;
  onCreated: () => void;
}
export function CreateMotorcycleDialog({ onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const ref = useModalDialog("input");
  const controller = useCreateMotorcycle(onCreated);
  const isBusy = controller.form.formState.isSubmitting;
  return (
    <dialog
      ref={ref}
      className={cn(dialog.dialog, styles.wide)}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        if (!isBusy) onClose();
      }}
      onClose={(event) => {
        handleClose(event.currentTarget, isBusy, onClose);
      }}
    >
      <h2 id={id} className={dialog.title}>
        {t("fleet.create.title")}
      </h2>
      <CreateMotorcycleForm controller={controller} onClose={onClose} />
    </dialog>
  );
}
