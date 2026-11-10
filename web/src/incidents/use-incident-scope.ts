import { useApiClient } from "../api/ApiClientProvider";
import { useSessionIdentity } from "../session/use-session-identity";
/** Screens read identity only; the shared session controller is its sole writer. */
export function useIncidentScope() {
  return { client: useApiClient(), identity: useSessionIdentity() };
}
export function incidentScopeKey(identity: ReturnType<typeof useSessionIdentity>) {
  return JSON.stringify([
    identity.userId,
    identity.organizationSlug,
    identity.authorization,
    identity.activeCenter,
  ]);
}
