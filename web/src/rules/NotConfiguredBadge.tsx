import { CircleDashed } from "lucide-react";
import { useTranslation } from "react-i18next";
import styles from "./rules.module.css";

/** A parameter with no version yet: an icon and a word next to the color, never the color alone. */
export function NotConfiguredBadge() {
  const { t } = useTranslation();
  return (
    <span className={styles.notConfigured}>
      <CircleDashed className={styles.badgeIcon} aria-hidden="true" />
      {t("rules.status.notConfigured")}
    </span>
  );
}
