import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import styles from "./TopBar.module.css";

/** Place of the notifications panel (W5). No unread count and no panel until the API exists. */
export function NotificationsSlot() {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={t("shell.topBar.notifications")}
    >
      <Bell aria-hidden="true" className={styles.icon} />
    </button>
  );
}
