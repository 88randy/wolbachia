import { useTranslation } from "react-i18next";
import { DataTable } from "../data-table/DataTable";
import { cursorTableData } from "../data-table/table-data";
import { useNotificationColumns } from "./use-notification-columns";
import { notificationKindKey } from "./notification-labels";
import { NotificationReadActions } from "./NotificationReadActions";
import type { Notification } from "./notification-query";
import type { useNotificationTray } from "./use-notification-tray";
export function NotificationTable({ tray }: { tray: ReturnType<typeof useNotificationTray> }) {
  const { t } = useTranslation();
  const columns = useNotificationColumns();
  const groupOf = (row: Notification) => ({
    id: `${row.read_at === null ? "unread" : "read"}-${row.kind}`,
    label: `${t(row.read_at === null ? "notifications.inbox.unread" : "notifications.inbox.read")} · ${t(notificationKindKey(row.kind))}`,
  });
  const rowActions = (row: Notification) =>
    row.read_at === null && <NotificationReadActions command={tray.command} id={row.id} />;
  return (
    <DataTable
      caption={t("notifications.page.title")}
      columns={columns}
      controller={tray.controller}
      getRowId={(row: Notification) => row.id}
      data={cursorTableData(tray.query)}
      groupOf={groupOf}
      rowActions={rowActions}
    />
  );
}
