import { useTranslation } from "react-i18next";
import { RelativeTime } from "../analytics/RelativeTime";
import { useMe } from "../session/use-me";
import type { DataTableColumn } from "../data-table/table-types";
import { NotificationMessage } from "./NotificationMessage";
import type { Notification } from "./notification-query";

export function useNotificationColumns(): DataTableColumn<Notification>[] {
  const { t } = useTranslation();
  const timezone = useMe().organization?.timezone ?? "UTC";
  return [
    {
      id: "message",
      headerKey: "notifications.column.message",
      cell: (row) => <NotificationMessage notification={row} />,
    },
    {
      id: "date",
      headerKey: "notifications.column.date",
      cell: (row) => <RelativeTime dateTime={row.created_at} timeZone={timezone} />,
    },
    {
      id: "status",
      headerKey: "notifications.column.status",
      cell: (row) =>
        t(row.read_at === null ? "notifications.inbox.unread" : "notifications.inbox.read"),
    },
  ];
}
