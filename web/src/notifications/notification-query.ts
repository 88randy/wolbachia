import { ApiError, unwrap } from "@wolbachia/api-client";
import type { ApiClient, operations, Schemas } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";

export type Notification = Schemas["Notification"];
export type NotificationPage = Schemas["NotificationPage"];
export type Preferences = Schemas["NotificationPreferences"];
export type Preference = Preferences["preferences"][number];
export type NotificationQuery = NonNullable<
  operations["notifications_list"]["parameters"]["query"]
>;
export interface NotificationScope {
  client: ApiClient;
  identity: SessionIdentity;
}
export const NOTIFICATION_POLL_MS = 30_000;

/** Definitive access failures retire cached sensitive rows immediately. */
export function visibleNotificationAnswer<T>(answer: {
  data: T | undefined;
  error: Error | null;
}): T | undefined {
  return answer.error instanceof ApiError && [401, 403, 404].includes(answer.error.status)
    ? undefined
    : answer.data;
}

/** The head is polled only while visible; reconnect always asks for a fresh unread total. */
export function notificationOptions(scope: NotificationScope, query: NotificationQuery = {}) {
  return {
    ...orgScopedQueryOptions(scope.identity, {
      key: ["notifications", "inbox", query],
      queryFn: async ({ signal }) =>
        unwrap(
          await scope.client.GET("/api/v1/notifications/", {
            params: { query },
            signal,
          }),
        ),
    }),
    refetchInterval: NOTIFICATION_POLL_MS,
    refetchOnReconnect: "always" as const,
  };
}

export function preferenceOptions(scope: NotificationScope) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["notifications", "preferences"],
    queryFn: async ({ signal }) =>
      unwrap(await scope.client.GET("/api/v1/me/notification-preferences/", { signal })),
  });
}
