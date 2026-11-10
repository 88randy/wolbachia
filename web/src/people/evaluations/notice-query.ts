import { unwrap } from "@wolbachia/api-client";
import type { Schemas, operations } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import type { EvaluationScope } from "./evaluation-query";
export type NoticePolicy = Schemas["NoticePolicyRead"];
export type NoticeQuery = NonNullable<
  operations["evaluation_notice_policy_list"]["parameters"]["query"]
>;
/** Policy history is private configuration, never a receipt of publication or delivery. */
export function noticePoliciesOptions(scope: EvaluationScope, query: NoticeQuery) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["evaluations", "noticePolicies", query],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/evaluation-notice-policy/", { params: { query }, signal }),
      ),
  });
}
