import { useId, useMemo, useRef } from "react";
import { CancelledError } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import { useSessionIdentity } from "../session/use-session-identity";
import { useSessionGuard } from "../session/use-session-guard";
import { useMe } from "../session/use-me";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { QueryFunction } from "@tanstack/react-query";
import type { FleetScope } from "./fleet-query";
import { useLocation } from "@tanstack/react-router";
import { centerIdentity } from "../centers/center-filter";
import { currentRevision, isSessionKnown } from "../session/session-revision";
function ownsPath(pathname: string, code: string) {
  try {
    return (
      decodeURIComponent(pathname.replace(/\/$/, "")) ===
      `/fleet/motorcycles${code ? "/" + code : ""}`
    );
  } catch (error) {
    if (error instanceof URIError) return false;
    throw error;
  }
}

/** A target/authorization entry is unique even after A→B→A; reauth keeps permitted RAM drafts. */
function useEntry(signature: string) {
  const owner = useId();
  const sequence = useRef(0);
  const entry = useMemo(() => ({ signature, epoch: ++sequence.current }), [signature]);
  const latest = useRef(entry);
  latest.current = entry;
  return {
    context: `${owner}:${String(entry.epoch)}:${signature}`,
    isCurrent: () => latest.current === entry,
  };
}
function scopeParts(identity: FleetScope["identity"]) {
  return [
    identity.userId,
    identity.organizationSlug,
    identity.authorization,
    identity.activeCenter,
  ];
}
export function useFleetScope(code: string, urlCenter?: string) {
  const session = useSessionIdentity();
  const pathname = useLocation({ select: (location) => location.pathname });
  const identity = {
    ...centerIdentity(session, urlCenter),
    isSettled: session.isSettled && ownsPath(pathname, code),
  };
  const client = useApiClient();
  const centers = useMe().scope.centers;
  const begin = useSessionGuard();
  const signature = JSON.stringify([...scopeParts(identity), urlCenter, code, pathname]);
  const entry = useEntry(signature);
  return {
    client,
    identity,
    centers,
    ...(urlCenter ? { urlCenter } : {}),
    code,
    begin,
    context: entry.context,
    isCurrent: () =>
      entry.isCurrent() && isSessionKnown() && identity.revision === currentRevision(),
  };
}
export type FleetRecordScope = ReturnType<typeof useFleetScope>;
/** Coarse UI eligibility uses this one actual center. The server still rechecks its real binding. */
export function canFleetAction(scope: FleetRecordScope, center: string | null, permission: string) {
  return (
    scope.identity.isSettled &&
    scope.isCurrent() &&
    scope.identity.permissions?.includes(permission) === true &&
    (scope.centers.mode === "all" ||
      (center !== null && scope.centers.mode === "selected" && scope.centers.ids.includes(center)))
  );
}

export function assertFleetRead(scope: FleetScope, signal: AbortSignal) {
  if (
    signal.aborted ||
    !scope.identity.isSettled ||
    !isSessionKnown() ||
    scope.identity.revision !== currentRevision() ||
    scope.isCurrent?.() === false
  )
    throw new CancelledError({ revert: true });
}
/** Keep the canonical org/session policy; record owners reject placeholder data. */
export function fleetScopedOptions<T>(
  scope: FleetScope,
  key: readonly unknown[],
  read: QueryFunction<T>,
) {
  const fence = scope.context ?? JSON.stringify([scope.identity, scope.urlCenter]);
  return orgScopedQueryOptions(scope.identity, {
    key: [...key, fence],
    queryFn: async (context) => {
      assertFleetRead(scope, context.signal);
      try {
        return await read(context);
      } finally {
        assertFleetRead(scope, context.signal);
      }
    },
  });
}
