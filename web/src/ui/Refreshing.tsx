import { useTranslation } from "react-i18next";
import styles from "./ui.module.css";
export function Refreshing() {
  const { t } = useTranslation();
  return (
    <span role="status" className={styles.refreshing}>
      {t("ui.states.refreshing")}
    </span>
  );
}
