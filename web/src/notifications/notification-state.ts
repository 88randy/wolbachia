import type { Notification, NotificationPage } from "./notification-query";

/** New head rows win over duplicate cursor snapshots; no unread newcomer can be overwritten. */
export function mergeNotifications(
  head: readonly Notification[],
  page: readonly Notification[],
): Notification[] {
  const seen = new Set<string>();
  return [...head, ...page].filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

/** Read commands target known unread rows; every cached page carries the same global total. */
export function markNotificationsRead(page: NotificationPage, id: string): NotificationPage {
  const isAll = id === "all";
  const existing = page.results.find((row) => row.id === id);
  const decrement = existing?.read_at ? 0 : 1;
  return {
    ...page,
    unread_total: isAll ? 0 : Math.max(0, page.unread_total - decrement),
    results: page.results.map((row) =>
      (isAll || row.id === id) && row.read_at === null
        ? { ...row, read_at: new Date().toISOString() }
        : row,
    ),
  };
}
