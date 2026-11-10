import { useApiClient } from "../api/ApiClientProvider";
import { useSessionIdentity } from "../session/use-session-identity";
/** A changed authority, center or session remounts all in-flight editors. */
export function useLabScope() {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const key = JSON.stringify([
    identity.userId,
    identity.organizationSlug,
    identity.authorization,
    identity.activeCenter,
    identity.revision,
  ]);
  const draftKey = JSON.stringify([identity.userId, identity.organizationSlug]);
  return { client, identity, key, draftKey };
}
