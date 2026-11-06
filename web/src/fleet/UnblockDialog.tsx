import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useModalDialog } from "../session/use-modal-dialog";
import styles from "../void/void-dialog.module.css";
import type { Motorcycle } from "./fleet-query";
import { UnblockDialogForm } from "./UnblockDialogForm";
import { useUnblockForm } from "./use-unblock-form";

interface Props {
  motorcycle: Motorcycle;
  onDone: () => void;
  onCancel: () => void;
}

function handleClose(dialog: HTMLDialogElement, isBusy: boolean, onCancel: () => void) {
  if (!dialog.isConnected || dialog.open) return;
  if (!isBusy) onCancel();
  else {
    dialog.showModal();
    dialog.querySelector("textarea")?.focus();
  }
}

/** Native modality preserves the existing keyboard/focus lifecycle for unblock evidence. */
export function UnblockDialog({ motorcycle, onDone, onCancel }: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const ref = useModalDialog("[data-unblock-cancel]");
  const form = useUnblockForm(motorcycle.id, onDone);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!form.isBusy) onCancel();
      }}
      onClose={(event) => {
        handleClose(event.currentTarget, form.isBusy, onCancel);
      }}
    >
      <h2 id={titleId} className={styles.title}>
        {t("fleet.unblock.title", { record: motorcycle.code })}
      </h2>
      <p className={styles.hint}>{t("fleet.unblock.hint")}</p>
      <UnblockDialogForm form={form} onCancel={onCancel} />
    </dialog>
  );
}
