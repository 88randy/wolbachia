import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { NotificationPanelContent } from "./NotificationPanelContent";
import { NotificationReadActions } from "./NotificationReadActions";
import { NotificationFeedback } from "./NotificationFeedback";
import { useNotificationCommand } from "./use-notification-command";
import type { NotificationPage } from "./notification-query";
import type { useNotificationScope } from "./use-notification-scope";
import styles from "./notifications.module.css";
interface Props {
  scope: ReturnType<typeof useNotificationScope>;
  answer: NotificationPage | undefined;
  error: unknown;
  refetch: () => void;
  close: () => void;
}
export function NotificationPanel({ scope, answer, error, refetch, close }: Props) {
  const { t } = useTranslation();
  const command = useNotificationCommand(scope);
  return (
    <div className={styles.workspace}>
      <p role="status" aria-live="polite">
        {t("notifications.inbox.total", { count: answer?.unread_total ?? "…" })}
      </p>
      <NotificationReadActions command={command} disabled={!answer?.unread_total} />
      <NotificationFeedback command={command} retry={command.retry} />
      <NotificationPanelContent {...{ answer, error, refetch, command }} />
      <Link to="/notifications" onClick={close}>
        {t("notifications.page.all")}
      </Link>
    </div>
  );
}
