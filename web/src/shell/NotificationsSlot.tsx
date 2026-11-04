import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import utilities from "../styles/utilities.module.css";
import styles from "./TopBar.module.css";

/**
 * Place of the notifications panel (W5). Announced as unavailable (aria-disabled) and kept
 * focusable so keyboard users find it; no unread count and no panel until the API exists.
 */
const NOTIFICATIONS_HINT_ID = "notifications-hint";

export function NotificationsSlot() {
  const { t } = useTranslation();
  return (
    <>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={t("shell.topBar.notifications")}
        aria-disabled="true"
        aria-describedby={NOTIFICATIONS_HINT_ID}
      >
        <Bell aria-hidden="true" className={styles.icon} />
      </button>
      <span id={NOTIFICATIONS_HINT_ID} className={utilities.srOnly}>
        {t("shell.topBar.notificationsSoon")}
      </span>
    </>
  );
}
