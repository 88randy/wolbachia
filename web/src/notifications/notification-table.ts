import type { TableQueryConfig, TableState } from "../data-table/table-types";
import type { NotificationQuery } from "./notification-query";
export const NOTIFICATION_TABLE: TableQueryConfig = {
  paging: "cursor",
  pageSize: 50,
  sortableIds: [],
  supportsVoided: false,
  filters: [
    {
      kind: "select",
      key: "kind",
      labelKey: "notifications.filter.kind",
      options: [
        { value: "critical", labelKey: "notifications.kind.critical" },
        { value: "incident", labelKey: "notifications.kind.incident" },
        { value: "training", labelKey: "notifications.kind.training" },
        { value: "system", labelKey: "notifications.kind.system" },
      ],
    },
    {
      kind: "select",
      key: "unread",
      labelKey: "notifications.filter.unread",
      options: [
        { value: "true", labelKey: "notifications.inbox.unread" },
        { value: "false", labelKey: "notifications.inbox.read" },
      ],
    },
  ],
};

/** Only validated server filters leave the address bar. */
export function notificationQuery(state: TableState): NotificationQuery {
  const kind = state.filters["kind"];
  return {
    ...(state.cursor ? { cursor: state.cursor } : {}),
    ...(kind === "critical" || kind === "incident" || kind === "training" || kind === "system"
      ? { kind }
      : {}),
    ...(state.filters["unread"] === "true" || state.filters["unread"] === "false"
      ? { unread: state.filters["unread"] }
      : {}),
  };
}
