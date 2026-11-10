import { useTranslation } from "react-i18next";
import { FilterBar } from "../data-table/FilterBar";
import { NotificationFeedback } from "./NotificationFeedback";
import { NotificationReadActions } from "./NotificationReadActions";
import { NotificationTable } from "./NotificationTable";
import { useNotificationTray } from "./use-notification-tray";
import type { useNotificationScope } from "./use-notification-scope";
import styles from "./notifications.module.css";
export function NotificationTray({ scope }: { scope: ReturnType<typeof useNotificationScope> }) {
  const { t } = useTranslation();
  const tray = useNotificationTray(scope);
  return (
    <div className={styles.workspace}>
      <div className={styles.heading}>
        <p role="status" aria-live="polite">
          {t("notifications.inbox.total", { count: tray.head.data?.unread_total ?? "…" })}
        </p>
        <NotificationReadActions command={tray.command} disabled={!tray.head.data?.unread_total} />
      </div>
      <NotificationFeedback command={tray.command} retry={tray.command.retry} />
      <FilterBar controller={tray.controller} />
      <NotificationTable tray={tray} />
    </div>
  );
}
