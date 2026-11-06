import { useApiClient } from "../api/ApiClientProvider";
import { useSessionIdentity } from "../session/use-session-identity";
import { useSearch } from "@tanstack/react-router";
/** Authorization and center belong to the request context, even on an A→B→A transition. */
export function useInventoryContext() {
  const session = useSessionIdentity();
  const search = useSearch({ strict: false });
  const activeCenter =
    typeof search["center"] === "string" ? search["center"] : session.activeCenter;
  const identity = { ...session, activeCenter };
  const client = useApiClient();
  const base = `${identity.userId}|${identity.organizationSlug}`;
  const context = `${base}|${String(identity.revision)}|${identity.authorization ?? ""}|${identity.activeCenter ?? ""}`;
  return { client, identity, base, context };
}
