import { ApiError } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import { NO_ACTIVE_MEMBERSHIP } from "../api/error-codes";
import type { QueryClient } from "@tanstack/react-query";
import { ME_QUERY_KEY } from "./me-key";
import { fetchMeCommitted } from "./me-query";
import { begin, failIfCurrent, settleWithoutIdentity } from "./session-controller";
import { isSessionKnown } from "./session-revision";

const HTTP_FORBIDDEN = 403;

/** `full`: another tab or this one changed the session. `verify`: only checking (focus). */
export type ReconcileMode = "full" | "verify";

/**
 * The cookie is the truth (#82). EVERY path that can observe a session change goes through here
 * (another tab's broadcast or `storage` event, window focus, the tab becoming visible, the
 * explicit retry, a login that completed on the server while the tab had moved on, a response
 * attested for another identity). The operation begins (`begin`: `full` leaves `known`, `verify`
 * only enters `reconciling`) and asks `/me/`; the answer is a candidate that `commitKnown` publishes
 * only while the operation's token is still the epoch. A stale run changes nothing; a failing
 * current run leaves `known` (`failIfCurrent`), never going back to the identity held before. A
 * `verify` that arrives while another run is in flight shares it. Resolves `true` when the session
 * is `known` afterwards (callers re-run the route guards only then); never rejects.
 * Receivers of another tab's announcement call this WITHOUT broadcasting again.
 */
export function reconcileSession(
  queryClient: QueryClient,
  client: ApiClient,
  mode: ReconcileMode = "full",
): Promise<boolean> {
  if (inFlight !== undefined && mode === "verify") return inFlight;
  const current = run(queryClient, client, mode);
  inFlight = current;
  void current.finally(() => {
    if (inFlight === current) inFlight = undefined;
  });
  return current;
}

let inFlight: Promise<boolean> | undefined;

function isNoMembership(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === HTTP_FORBIDDEN &&
    error.code === NO_ACTIVE_MEMBERSHIP
  );
}

async function run(queryClient: QueryClient, client: ApiClient, mode: ReconcileMode) {
  const token = begin(queryClient, mode === "full" ? "leave" : "verify");
  try {
    await queryClient.query({
      queryKey: ME_QUERY_KEY,
      queryFn: ({ signal, client: cache }) =>
        fetchMeCommitted({ client, queryClient: cache, signal }, { token }),
      staleTime: 0,
    });
  } catch (error) {
    // A 401 is also reported by the caches (like any request). A failing run that is still the
    // current one makes the identity UNKNOWN; a superseded one does nothing. "No membership" is an
    // answer, not a failure: the guards take the user to sign in.
    if (isNoMembership(error)) settleWithoutIdentity(token);
    else await failIfCurrent(queryClient, token);
  }
  return isSessionKnown();
}

/** `reconcileSession`, and the route guards run again when the session is `known` afterwards. */
export async function reconcileAndRevalidate(
  queryClient: QueryClient,
  client: ApiClient,
  router: { invalidate: () => Promise<void> },
): Promise<void> {
  if (await reconcileSession(queryClient, client)) await router.invalidate();
}
