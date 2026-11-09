import { useApiClient } from "../api/ApiClientProvider";
import { useSessionIdentity } from "../session/use-session-identity";
import { useLocation, useSearch, useParams } from "@tanstack/react-router";
import { createContext, useContext, useId, useMemo, useRef } from "react";
import { inventoryReadContext } from "./inventory-read-context";
import { useSessionGuard } from "../session/use-session-guard";
export const InventoryScopeContext = createContext<ReturnType<typeof useInventoryScope> | null>(
  null,
);
function useReadFence(signature: string) {
  const provider = useId();
  const sequence = useRef(0);
  const view = useMemo(() => ({ signature, epoch: ++sequence.current }), [signature]);
  const latest = useRef(view);
  latest.current = view;
  return {
    context: `${provider}:${String(view.epoch)}:${signature}`,
    isCurrentRead: () => latest.current === view,
  };
}
export function useInventoryCode(): string | undefined {
  const params: unknown = useParams({ strict: false });
  return typeof params === "object" &&
    params !== null &&
    "code" in params &&
    typeof params.code === "string"
    ? params.code
    : undefined;
}
/** Authorization and center belong to the request context, even on an A→B→A transition. */
export function useInventoryScope() {
  const session = useSessionIdentity();
  const search = useSearch({ strict: false });
  const activeCenter =
    typeof search["center"] === "string" ? search["center"] : session.activeCenter;
  const identity = { ...session, activeCenter };
  const client = useApiClient();
  const pathname = useLocation({ select: (location) => location.pathname });
  const parsed = inventoryReadContext(search);
  const readContext =
    parsed.mode === "custody" && !/^\/inventory\/(lots|locations)(\/|$)/.test(pathname)
      ? { mode: "invalid" as const }
      : parsed;
  const beginWrite = useSessionGuard();
  const base = `${identity.userId}|${identity.organizationSlug}`;
  const signature = JSON.stringify([base, identity, pathname, readContext]);
  const fence = useReadFence(signature);
  return {
    client,
    identity,
    base,
    ...fence,
    readContext,
    beginWrite,
    pathname,
  };
}
export function useInventoryContext() {
  const inherited = useContext(InventoryScopeContext);
  const fallback = useInventoryScope();
  return inherited ?? fallback;
}
