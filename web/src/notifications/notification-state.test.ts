import { expect, test } from "vitest";
import { mergeNotifications, markNotificationsRead } from "./notification-state";
import type { Notification, NotificationPage } from "./notification-query";

const first: Notification = {
  id: "00000000-0000-4000-8000-000000000150",
  kind: "incident",
  code: "incident.created",
  params: {},
  created_at: "2026-11-01T12:00:00Z",
  read_at: null,
  object_ref: null,
};
const page: NotificationPage = { results: [first], next: null, previous: null, unread_total: 2 };

test("reconnect merges duplicate cursor rows while retaining the new unread item", () => {
  const newest = { ...first, id: "new", created_at: "2026-11-02T12:00:00Z" };
  expect(mergeNotifications([newest, first], [first]).map((row) => row.id)).toEqual([
    "new",
    first.id,
  ]);
});

test("optimistic read-all clears the total even when unread rows are on another cursor", () => {
  const updated = markNotificationsRead(page, "all");
  expect(updated.unread_total).toBe(0);
  expect(updated.results[0]?.read_at).not.toBeNull();
  expect(page.results[0]?.read_at).toBeNull();
});
