import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import type { TableState } from "../data-table/table-types";
import { useSessionIdentity } from "../session/use-session-identity";
import { versionsQueryOptions } from "./rules-query";

/** The history of one parameter, org-scoped through the session identity (#82). */
export function useVersionsQuery(parameterKey: string, state: TableState) {
  const client = useApiClient();
  const identity = useSessionIdentity();
  return useQuery(versionsQueryOptions({ client, identity }, parameterKey, state));
}
