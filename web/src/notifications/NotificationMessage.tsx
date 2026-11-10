import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMe } from "../session/use-me";
import { notificationMessageKey } from "./notification-labels";
import type { Notification } from "./notification-query";
import styles from "./notifications.module.css";
import { notificationDestination } from "./notification-destination";

/** Only backend-authorized references become links; destination pages recheck object access. */
export function NotificationMessage({ notification }: { notification: Notification }) {
  const { t } = useTranslation();
  const me = useMe();
  const reference = notification.object_ref;
  const destination = notificationDestination(reference, me.permissions);
  return (
    <div className={styles.message}>
      <span className={notification.read_at === null ? styles.unread : undefined}>
        {t(notificationMessageKey(notification.code))}
      </span>
      {destination ? (
        <Link {...destination}>{reference?.code ?? t("notifications.inbox.open")}</Link>
      ) : reference ? (
        <span className={styles.label}>{t("notifications.inbox.unavailable")}</span>
      ) : null}
      {destination && reference?.is_voided && <span>{t("notifications.inbox.voided")}</span>}
    </div>
  );
}
