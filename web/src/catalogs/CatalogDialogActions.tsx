import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { classNames } from "../styles/class-names";
import buttons from "../styles/button.module.css";
import styles from "./catalogs.module.css";
interface Props {
  isBusy: boolean;
  onCancel: () => void;
  confirmKey: MessageKey;
  onConfirm?: () => void;
}
/** A form submit by default; plain confirmation dialogs provide their own callback. */
export function CatalogDialogActions({ isBusy, onCancel, confirmKey, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <div className={styles.actions}>
      <button
        className={classNames(buttons.button, buttons.secondary)}
        type="button"
        disabled={isBusy}
        onClick={onCancel}
      >
        {t("common.actions.cancel")}
      </button>
      <button
        className={classNames(buttons.button, buttons.primary)}
        type={onConfirm ? "button" : "submit"}
        disabled={isBusy}
        onClick={onConfirm}
      >
        {t(isBusy ? "catalogs.form.busy" : confirmKey)}
      </button>
    </div>
  );
}
