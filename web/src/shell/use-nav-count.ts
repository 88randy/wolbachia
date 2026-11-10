import { useQuery } from "@tanstack/react-query";
import { notificationOptions, visibleNotificationAnswer } from "../notifications/notification-query";
import { useNotificationScope } from "../notifications/use-notification-scope";
import type { AreaId } from "../router/areas";

/**
 * Counter badge of a sidebar item. Notifications reuse the bell query (same cache key), so the
 * badge costs no extra request. Areas without a counter return undefined.
 */
export function useNavCount(areaId: AreaId): number | undefined {
  const scope = useNotificationScope();
  const options = notificationOptions(scope);
  const query = useQuery({
    ...options,
    enabled: areaId === "notifications" && scope.isAllowed && options.enabled,
  });
  if (areaId !== "notifications" || !scope.isAllowed) return undefined;
  const total = visibleNotificationAnswer(query)?.unread_total;
  return total && total > 0 ? total : undefined;
}
