import { useQuery } from "@tanstack/react-query";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { notificationOptions, visibleNotificationAnswer } from "./notification-query";
import { NOTIFICATION_TABLE, notificationQuery } from "./notification-table";
import { useNotificationCommand } from "./use-notification-command";
import { mergeNotifications } from "./notification-state";
import type { useNotificationScope } from "./use-notification-scope";
export function useNotificationTray(scope: ReturnType<typeof useNotificationScope>) {
  const controller = useTableUrlState(NOTIFICATION_TABLE);
  const query = useQuery(notificationOptions(scope, notificationQuery(controller.state)));
  const head = useQuery(
    notificationOptions(scope, notificationQuery({ ...controller.state, cursor: null })),
  );
  const command = useNotificationCommand(scope);
  const current = visibleNotificationAnswer(query);
  const currentHead = visibleNotificationAnswer(head);
  const answer = current && {
    ...current,
    results: controller.state.cursor
      ? mergeNotifications(currentHead?.results ?? [], current.results)
      : current.results,
  };
  return {
    controller,
    query: { ...query, data: answer },
    head: { ...head, data: currentHead },
    command,
  };
}
