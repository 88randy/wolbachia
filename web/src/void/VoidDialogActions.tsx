import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import styles from "./void-dialog.module.css";
interface VoidDialogActionsProps {
  isBusy: boolean;
  isBlocked: boolean;
  onCancel: () => void;
}
/** A pending confirmation retains its width and focus and refuses a second submission. */
export function VoidDialogActions({ isBusy, isBlocked, onCancel }: VoidDialogActionsProps) {
  const { t } = useTranslation();
  function cancel() {
    if (!isBusy) onCancel();
  }
  return (
    <div className={styles.actions}>
      <Button variant="secondary" aria-disabled={isBusy} onClick={cancel} data-void-cancel>
        {t("common.actions.cancel")}
      </Button>
      <Button
        type="submit"
        disabled={isBlocked}
        className={styles.danger}
        loading={isBusy}
        aria-label={isBusy ? t("voiding.dialog.busy") : undefined}
      >
        {t("voiding.dialog.confirm")}
      </Button>
    </div>
  );
}
