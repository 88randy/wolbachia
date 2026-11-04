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
 * Cancel (outlined) and the destructive confirmation. While busy the confirmation is
 * `aria-disabled`, not `disabled`, so keyboard focus is not lost and a second press sends nothing.
 */
export function VoidDialogActions({ isBusy, onCancel }: VoidDialogActionsProps) {
  const { t } = useTranslation();
  function ignoreWhileBusy(event: MouseEvent) {
    if (isBusy) event.preventDefault();
  }
  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={classNames(buttons.button, buttons.secondary)}
        onClick={onCancel}
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
