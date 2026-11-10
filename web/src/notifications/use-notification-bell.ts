import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { notificationOptions, visibleNotificationAnswer } from "./notification-query";
import { useNotificationScope, notificationOwner } from "./use-notification-scope";
export function useNotificationBell() {
  const scope = useNotificationScope();
  const query = useQuery(notificationOptions(scope));
  const [opened, setOpened] = useState<string | null>(null);
  const owner = notificationOwner(scope);
  const onOpenChange = (value: boolean) => {
    setOpened(value ? owner : null);
  };
  return {
    scope,
    query: { ...query, data: visibleNotificationAnswer(query) },
    owner,
    open: opened === owner,
    onOpenChange,
    close: () => {
      setOpened(null);
    },
  };
}
