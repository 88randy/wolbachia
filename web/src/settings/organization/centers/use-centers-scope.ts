import { useApiClient } from "../../../api/ApiClientProvider";
import { useSessionIdentity } from "../../../session/use-session-identity";
import type { CentersScope } from "./centers-api";

/** API client and session identity for the queries of the centers screens. */
export function useCentersScope(): CentersScope {
  return { client: useApiClient(), identity: useSessionIdentity() };
}
