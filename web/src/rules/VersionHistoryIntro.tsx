import { useTranslation } from "react-i18next";
import { RULE_HISTORY_NOTE_ID } from "./history-ids";
import styles from "./rules.module.css";
export function VersionHistoryIntro({ canVoid }: { canVoid: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={styles.historyHeader}>
      <p className={styles.hint}>{t("rules.history.hint")}</p>
      {canVoid && (
        <p id={RULE_HISTORY_NOTE_ID} className={styles.voidBlocked}>
          {t("rules.history.voidBlocked")}
        </p>
      )}
    </div>
  );
}
