import { useTranslation } from "react-i18next";
import { tableErrorKey } from "../data-table/table-error";
import buttons from "../styles/button.module.css";
import styles from "./fleet.module.css";
export function FleetLoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className={styles.card}>
      <p>{t(tableErrorKey(error))}</p>
      <p>{t("fleet.record.refreshRequired")}</p>
      <button type="button" className={buttons.button} onClick={onRetry}>
        {t("common.actions.retry")}
      </button>
    </div>
  );
}
