import { useTranslation } from "react-i18next";
import { NotificationMessage } from "./NotificationMessage";
import { NotificationReadActions } from "./NotificationReadActions";
import { notificationKindKey } from "./notification-labels";
import type { Notification } from "./notification-query";
import type { useNotificationCommand } from "./use-notification-command";
import styles from "./notifications.module.css";
interface Props {
  row: Notification;
  command: ReturnType<typeof useNotificationCommand>;
}
export function NotificationPanelRow({ row, command }: Props) {
  const { t } = useTranslation();
  return (
    <li className={styles.panelRow}>
      <span className={styles.label}>
        {t(notificationKindKey(row.kind))} ·{" "}
        {t(row.read_at === null ? "notifications.inbox.unread" : "notifications.inbox.read")}
      </span>
      <NotificationMessage notification={row} />
      {row.read_at === null && <NotificationReadActions command={command} id={row.id} />}
    </li>
  );
}
