import { useApiClient } from "../api/ApiClientProvider";
import { useSessionIdentity } from "../session/use-session-identity";
import type { SessionIdentity } from "../session/org-scoped-query";
/** Read-only session context; this screen never writes session state. */
export function useReceptionScope() {
  return { client: useApiClient(), identity: useSessionIdentity() };
}
export function receptionScopeKey(identity: SessionIdentity): string {
  return JSON.stringify([identity.userId, identity.organizationSlug, identity.authorization]);
}
