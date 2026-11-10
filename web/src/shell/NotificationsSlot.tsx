import { NotificationOverlay } from "../notifications/NotificationOverlay";
import { useNotificationBell } from "../notifications/use-notification-bell";

/** W5 durable badge and panel, restricted by the current settled session scope. */
export function NotificationsSlot() {
  const model = useNotificationBell();
  if (!model.scope.isAllowed || !model.scope.identity.isSettled) return null;
  return <NotificationOverlay model={model} />;
}
