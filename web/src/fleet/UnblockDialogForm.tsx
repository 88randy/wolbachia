import { useId } from "react";
import { useTranslation } from "react-i18next";
import { FormAlert } from "../forms/FormAlert";
import { useFocusAlert } from "../forms/use-focus-alert";
import styles from "../void/void-dialog.module.css";
import { UnblockReasonField } from "./UnblockReasonField";
import { UnblockDialogActions } from "./UnblockDialogActions";
import type { UnblockForm } from "./use-unblock-form";
import { unblockFailureKey } from "./unblock-failure";

export function UnblockDialogForm({ form, onCancel }: { form: UnblockForm; onCancel: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  const alertRef = useFocusAlert(form.failure);
  return (
    <form className={styles.form} onSubmit={form.handleSubmit} noValidate>
      <UnblockReasonField form={form} />
      {form.failure !== undefined && (
        <FormAlert
          id={id}
          ref={alertRef}
          title={t("fleet.unblock.failure")}
          text={t(unblockFailureKey(form.failure))}
        />
      )}
      <UnblockDialogActions form={form} onCancel={onCancel} />
    </form>
  );
}
