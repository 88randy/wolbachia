import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useModalDialog } from "../session/use-modal-dialog";
import styles from "./void-dialog.module.css";
import { VoidDialogForm } from "./VoidDialogForm";
import { useVoidForm } from "./use-void-form";
import type { VoidResult } from "./submit-void";
import type { VoidLimits } from "./void-limits";

export interface VoidDialogProps {
  /** Code or name of the record, shown in the title ("Void OV-010"). */
  record: string;
  /** From `useVoidLimits()` (the server's values in `GET /me/`). */
  limits: VoidLimits;
  /** Sends the void with the trimmed reason: `submitVoid(() => client.POST(...))`. */
  submit: (reason: string) => Promise<VoidResult>;
  /** The server voided the record: close the dialog and refresh what shows it. */
  onVoided: () => void;
  /** The user gave up (Cancel or Escape). Not called while a request is in flight. */
  onCancel: () => void;
}

const REASON_FIELD = "textarea";

/**
 * The shared "Void with reason" modal (#32). Mount it to open it, unmount it to close it. It is a
 * native modal `<dialog>`: the page behind is inert, Tab stays inside, and focus returns to the
 * button that opened it. It starts on the reason field; Escape and Cancel give up, unless a
 * request is in flight. Nothing here deletes anything: the server stores who, when and why.
 */
export function VoidDialog({ record, limits, submit, onVoided, onCancel }: VoidDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useModalDialog(REASON_FIELD);
  const form = useVoidForm({ limits, submit, onVoided });
  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!form.isBusy) onCancel();
      }}
    >
      <h2 id={titleId} className={styles.title}>
        {t("voiding.dialog.title", { record })}
      </h2>
      <p className={styles.hint}>{t("voiding.dialog.hint")}</p>
      <VoidDialogForm form={form} alertId={`${titleId}-failure`} onCancel={onCancel} />
    </dialog>
  );
}
