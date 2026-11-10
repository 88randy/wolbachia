import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card } from "../ui/Card";
import { preferenceOptions, visibleNotificationAnswer } from "./notification-query";
import { NotificationPreferenceContent } from "./NotificationPreferenceContent";
import { NotificationFeedback } from "./NotificationFeedback";
import { useNotificationCommand } from "./use-notification-command";
import type { useNotificationScope } from "./use-notification-scope";
export function NotificationPreferences({
  scope,
}: {
  scope: ReturnType<typeof useNotificationScope>;
}) {
  const { t } = useTranslation();
  const query = useQuery(preferenceOptions(scope));
  const command = useNotificationCommand(scope);
  const canUpdate = scope.identity.permissions?.includes("notification_preference.update") === true;
  const refetch = () => {
    void query.refetch();
  };
  return (
    <Card title={t("notifications.preferences.title")}>
      <NotificationFeedback command={command} retry={command.retry} />
      <NotificationPreferenceContent
        {...{ command, canUpdate, refetch }}
        answer={visibleNotificationAnswer(query)}
        error={query.error}
      />
    </Card>
  );
}
