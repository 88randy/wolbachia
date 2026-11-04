import { sessionIdentityOf } from "./org-scoped-query";
import type { SessionIdentity } from "./org-scoped-query";
import { useMe } from "./use-me";

/** The identity of the signed-in session, for `orgScopedQueryOptions`. */
export function useSessionIdentity(): SessionIdentity {
  const me = useMe();
  return sessionIdentityOf(me);
}
