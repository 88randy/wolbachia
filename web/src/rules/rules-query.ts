import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import { queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { TableState } from "../data-table/table-types";
import { PARAMETERS_PAGE_SIZE, VERSIONS_PAGE_SIZE } from "./rules-table";

export type RuleParameter = Schemas["RuleParameter"];
export type RuleParameterVersion = Schemas["RuleParameterVersion"];

/**
 * Every server-state query of W62 lives in this file, and nothing else builds a key for these
 * resources. Org-scoped keys will carry the session identity (#82): when that helper lands, this
 * is the only file that changes (the keys below and `invalidateRuleParameters`).
 */
const ROOT = "rule-parameters";

/** `GET /api/v1/rule-parameters/`: the parameters with the value in force now. */
export function parametersQueryOptions(client: ApiClient, state: TableState) {
  return queryOptions({
    queryKey: [ROOT, "list", state.page],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/rule-parameters/", {
          params: { query: { page: state.page, page_size: PARAMETERS_PAGE_SIZE } },
          signal,
        }),
      ),
  });
}

/** `GET /api/v1/rule-parameters/{key}/`: one parameter (the key is its human code). */
export function parameterQueryOptions(client: ApiClient, key: string) {
  return queryOptions({
    queryKey: [ROOT, "detail", key],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/rule-parameters/{key}/", { params: { path: { key } }, signal }),
      ),
  });
}

/** `GET /api/v1/rule-parameters/{key}/versions/`: the whole history, voided versions included. */
export function versionsQueryOptions(client: ApiClient, key: string, state: TableState) {
  return queryOptions({
    queryKey: [ROOT, "versions", key, state.page],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/rule-parameters/{parameter_key}/versions/", {
          params: {
            path: { parameter_key: key },
            query: { page: state.page, page_size: VERSIONS_PAGE_SIZE },
          },
          signal,
        }),
      ),
  });
}

/** A version was created or voided: the list, the parameter and its history are all stale. */
export function invalidateRuleParameters(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: [ROOT] });
}
