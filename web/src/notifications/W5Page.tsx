import { useTranslation } from "react-i18next";
import { ListPage } from "../components/templates/ListPage";
import { useDisplaySettled } from "../session/use-visible-session-state";
import { CardSkeleton } from "../ui/CardSkeleton";
import { FolderTabs } from "../ui/FolderTabs";
import { InlineNotice } from "../ui/InlineNotice";
import { NotificationPreferences } from "./NotificationPreferences";
import { NotificationTray } from "./NotificationTray";
import { notificationOwner, useNotificationScope } from "./use-notification-scope";

/** W5: the inbox (unread first, grouped by type) and the per-type preferences, as two tabs. */
export function W5Page() {
  const { t } = useTranslation();
  const scope = useNotificationScope();
  const isSettled = useDisplaySettled(scope.identity.isSettled);
  if (!scope.isAllowed)
    return <InlineNotice tone="warning">{t("notifications.page.denied")}</InlineNotice>;
  if (!isSettled) return <CardSkeleton />;
  return (
    <ListPage title={t("notifications.page.title")} key={notificationOwner(scope)}>
      <FolderTabs
        label={t("notifications.page.title")}
        defaultValue="inbox"
        items={[
          {
            value: "inbox",
            label: t("notifications.tabs.inbox"),
            content: <NotificationTray scope={scope} />,
          },
          {
            value: "preferences",
            label: t("notifications.tabs.preferences"),
            content: <NotificationPreferences scope={scope} />,
          },
        ]}
      />
    </ListPage>
  );
}
