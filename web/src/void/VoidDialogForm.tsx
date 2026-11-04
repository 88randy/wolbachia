import { useTranslation } from "react-i18next";
import { FormAlert } from "../forms/FormAlert";
import { useFocusAlert } from "../forms/use-focus-alert";
import styles from "./void-dialog.module.css";
import { VoidDialogActions } from "./VoidDialogActions";
import { VoidReasonField } from "./VoidReasonField";
import type { VoidForm } from "./use-void-form";
import { voidFailureKey } from "./void-failure";

interface VoidDialogFormProps {
  form: VoidForm;
  alertId: string;
  onCancel: () => void;
}

/** The reason field, the failure summary (focused when it appears) and the two buttons. */
export function VoidDialogForm({ form, alertId, onCancel }: VoidDialogFormProps) {
  const { t } = useTranslation();
  const alertRef = useFocusAlert(form.failure);
  return (
    <form className={styles.form} onSubmit={form.handleSubmit} noValidate>
      <VoidReasonField {...form} />
      {form.failure !== undefined && (
        <FormAlert
          id={alertId}
          ref={alertRef}
          title={t("voiding.error.title")}
          text={t(voidFailureKey(form.failure))}
        />
      )}
      <VoidDialogActions isBusy={form.isBusy} onCancel={onCancel} />
    </form>
  );
}
