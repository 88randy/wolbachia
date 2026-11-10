import { useTranslation } from "react-i18next";
import { ApiError } from "@wolbachia/api-client";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { NotificationPreference } from "./NotificationPreference";
import type { useNotificationCommand } from "./use-notification-command";
import type { Preferences } from "./notification-query";
import styles from "./notifications.module.css";
interface Props {
  answer: Preferences | undefined;
  error: unknown;
  refetch: () => void;
  command: ReturnType<typeof useNotificationCommand>;
  canUpdate: boolean;
}
export function NotificationPreferenceContent(props: Props) {
  const { answer, error, refetch, command, canUpdate } = props;
  const { t } = useTranslation();
  if (error && !answer)
    return (
      <ErrorState onRetry={refetch} code={error instanceof ApiError ? error.code : undefined} />
    );
  if (!answer) return <CardSkeleton />;
  return (
    <>
      {Boolean(error) && <ErrorState onRetry={refetch} />}
      {!canUpdate && <p>{t("notifications.preferences.readOnly")}</p>}
      <div className={styles.preferences}>
        {answer.preferences.map((preference) => (
          <NotificationPreference key={preference.kind} {...{ preference, command, canUpdate }} />
        ))}
      </div>
    </>
  );
}
