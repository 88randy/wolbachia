import { useTranslation } from "react-i18next";
import { InlineNotice } from "../ui/InlineNotice";
import { Button } from "../ui/Button";
import type { useNotificationCommand } from "./use-notification-command";
import styles from "./notifications.module.css";
interface Props {
  command: ReturnType<typeof useNotificationCommand>;
  retry: () => void;
}
export function NotificationFeedback({ command, retry }: Props) {
  const { t } = useTranslation();
  return (
    <>
      {!command.isOnline && (
        <InlineNotice tone="warning">{t("notifications.page.offline")}</InlineNotice>
      )}
      {command.status === "failed" && (
        <InlineNotice
          tone="warning"
          action={
            <Button variant="secondary" onClick={retry}>
              {t("common.actions.retry")}
            </Button>
          }
        >
          {t("notifications.inbox.failed")}
        </InlineNotice>
      )}
      <p role="status" aria-live="polite" className={styles.label}>
        {command.status === "saved" ? t("notifications.inbox.saved") : ""}
      </p>
    </>
  );
}
