import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas, operations } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import type { SessionIdentity } from "../../session/org-scoped-query";
export interface EvaluationScope {
  client: ApiClient;
  identity: SessionIdentity;
}
export type Evaluation = Schemas["EvaluationRead"];
export type RubricVersion = Schemas["RubricVersionRead"];
export type EvaluationQuery = NonNullable<operations["evaluations_list"]["parameters"]["query"]>;
export const PAGE_SIZE = 25;
export function evaluationsOptions(scope: EvaluationScope, query: EvaluationQuery) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["evaluations", "list", query],
    queryFn: async ({ signal }) =>
      unwrap(await scope.client.GET("/api/v1/evaluations/", { params: { query }, signal })),
  });
}
export function attemptsOptions(scope: EvaluationScope, target: { id: string; page: number }) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["evaluations", "attempts", target],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/evaluations/{id}/attempts/", {
          params: { path: { id: target.id }, query: { page: target.page, page_size: PAGE_SIZE } },
          signal,
        }),
      ),
  });
}
export function rubricsOptions(scope: EvaluationScope, code: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["evaluations", "rubric", code],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/evaluation-rubrics/", {
          params: { query: { code, page_size: 1 } },
          signal,
        }),
      ),
  });
}
export function rubricVersionsOptions(
  scope: EvaluationScope,
  target: { id: string; page: number },
) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["evaluations", "rubricVersions", target],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/evaluation-rubrics/{id}/versions/", {
          params: { path: { id: target.id }, query: { page: target.page, page_size: PAGE_SIZE } },
          signal,
        }),
      ),
  });
}
