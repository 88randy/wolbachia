import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import type { QueryClient } from "@tanstack/react-query";
import type { TableState } from "../data-table/table-types";
import { invalidateOrgScoped, orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";
import { PARAMETERS_PAGE_SIZE, VERSIONS_PAGE_SIZE } from "./rules-table";

export type RuleParameter = Schemas["RuleParameter"];
export type RuleParameterVersion = Schemas["RuleParameterVersion"];

/**
 * Every server-state query of W62 lives in this file, and nothing else builds a key for these
 * resources. They are org-scoped (`orgScopedQueryOptions`, #82): the key carries the session
 * identity and revision, and `invalidateRuleParameters` matches by resource.
 */
const ROOT = "rule-parameters";

/** Who asks and through which client; the identity goes into the key. */
export interface RuleScope {
  client: ApiClient;
  identity: SessionIdentity;
}

/** `GET /api/v1/rule-parameters/`: the parameters with the value in force now. */
export function parametersQueryOptions(
  client: ApiClient,
  identity: SessionIdentity,
  state: TableState,
) {
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "list", state.page],
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
export function parameterQueryOptions(client: ApiClient, identity: SessionIdentity, key: string) {
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "detail", key],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/rule-parameters/{key}/", { params: { path: { key } }, signal }),
      ),
  });
}

/** `GET /api/v1/rule-parameters/{key}/versions/`: the history; voided versions only with `include_voided`. */
export function versionsQueryOptions(
  { client, identity }: RuleScope,
  key: string,
  state: TableState,
) {
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "versions", key, state.page, state.includeVoided],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/rule-parameters/{parameter_key}/versions/", {
          params: {
            path: { parameter_key: key },
            query: {
              page: state.page,
              page_size: VERSIONS_PAGE_SIZE,
              include_voided: state.includeVoided ? "true" : "false",
            },
          },
          signal,
        }),
      ),
  });
}

/** A version was created or voided: the list, the parameter and its history are all stale. */
export function invalidateRuleParameters(queryClient: QueryClient): Promise<void> {
  return invalidateOrgScoped(queryClient, ROOT);
}
