import { useTranslation } from "react-i18next";
import { SideSheet } from "../ui/SideSheet";
import { NotificationTrigger } from "./NotificationTrigger";
import { NotificationPanel } from "./NotificationPanel";
import type { useNotificationBell } from "./use-notification-bell";
export function NotificationOverlay({ model }: { model: ReturnType<typeof useNotificationBell> }) {
  const { t } = useTranslation();
  const { scope, query, owner, open, onOpenChange, close } = model;
  const sheet = {
    title: t("notifications.page.title"),
    description: t("notifications.page.purpose"),
    open,
    onOpenChange,
  };
  const refetch = () => {
    void query.refetch();
  };
  return (
    <SideSheet {...sheet} trigger={<NotificationTrigger count={query.data?.unread_total} />}>
      <NotificationPanel
        key={owner}
        {...{ scope, refetch, close }}
        answer={query.data}
        error={query.error}
      />
    </SideSheet>
  );
}
