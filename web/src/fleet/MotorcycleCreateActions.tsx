import { useTranslation } from "react-i18next";
import { SubmitButton } from "../forms/SubmitButton";
import buttons from "../styles/button.module.css";
import styles from "./fleet.module.css";
export function MotorcycleCreateActions({
  isBusy,
  onClose,
}: {
  isBusy: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={buttons.button}
        aria-disabled={isBusy}
        onClick={() => {
          if (!isBusy) onClose();
        }}
      >
        {t("common.actions.cancel")}
      </button>
      <SubmitButton
        label={t("common.actions.save")}
        busyLabel={t("fleet.create.busy")}
        isBusy={isBusy}
      />
    </div>
  );
}
