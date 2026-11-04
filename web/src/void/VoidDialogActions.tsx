import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";
import styles from "./void-dialog.module.css";

interface VoidDialogActionsProps {
  isBusy: boolean;
  onCancel: () => void;
}

/**
 * Cancel (outlined) and the destructive confirmation. While busy both are `aria-disabled`, not
 * `disabled`, so keyboard focus is not lost, a second press sends nothing and the dialog cannot
 * be left while the server may still void the record.
 */
export function VoidDialogActions({ isBusy, onCancel }: VoidDialogActionsProps) {
  const { t } = useTranslation();
  function ignoreWhileBusy(event: MouseEvent) {
    if (isBusy) event.preventDefault();
  }
  function cancel() {
    if (!isBusy) onCancel();
  }
  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={classNames(buttons.button, buttons.secondary)}
        aria-disabled={isBusy}
        onClick={cancel}
      >
        {t("common.actions.cancel")}
      </button>
      <button
        type="submit"
        className={classNames(buttons.button, styles.danger)}
        aria-disabled={isBusy}
        onClick={ignoreWhileBusy}
      >
        {isBusy ? t("voiding.dialog.busy") : t("voiding.dialog.confirm")}
      </button>
    </div>
  );
}
