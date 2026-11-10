import { useApiClient } from "../api/ApiClientProvider";
import { useSessionIdentity } from "../session/use-session-identity";
import { useMe } from "../session/use-me";
import { useLayoutEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Me } from "../session/me";
import type { SessionIdentity } from "../session/org-scoped-query";

/** Empty selected dimensions deny access, just like explicit none. */
export function canReadNotifications(me: Pick<Me, "permissions" | "scope">): boolean {
  const hasDimension = (dimension: Me["scope"]["centers"]) =>
    dimension.mode === "all" || (dimension.mode === "selected" && dimension.ids.length > 0);
  return (
    me.permissions.includes("notification.read") &&
    hasDimension(me.scope.centers) &&
    hasDimension(me.scope.quadrants)
  );
}

function useRemoveObsoleteNotifications(identity: SessionIdentity) {
  const cache = useQueryClient();
  useLayoutEffect(() => {
    const obsolete = {
      predicate: (query: { queryKey: readonly unknown[]; meta?: Record<string, unknown> }) =>
        query.queryKey[3] === "notifications" &&
        (query.queryKey[1] !== identity.userId ||
          query.queryKey[2] !== identity.organizationSlug ||
          query.meta?.["authorization"] !== identity.authorization ||
          query.meta?.["center"] !== identity.activeCenter),
    };
    void cache.cancelQueries(obsolete);
    cache.removeQueries(obsolete);
  }, [
    cache,
    identity.userId,
    identity.organizationSlug,
    identity.authorization,
    identity.activeCenter,
  ]);
}
export function useNotificationScope() {
  const identity = useSessionIdentity();
  const isAllowed = canReadNotifications(useMe());
  useRemoveObsoleteNotifications(identity);
  return {
    client: useApiClient(),
    identity: { ...identity, isSettled: identity.isSettled && isAllowed },
    isAllowed,
  };
}

export function notificationOwner(scope: ReturnType<typeof useNotificationScope>): string {
  const { userId, organizationSlug, authorization, activeCenter } = scope.identity;
  return JSON.stringify([userId, organizationSlug, authorization, activeCenter]);
}
