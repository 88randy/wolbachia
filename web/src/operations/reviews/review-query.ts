import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas, operations } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import type { SessionIdentity } from "../../session/org-scoped-query";

export type Review = Schemas["ReviewItemDetail"];
export type ReviewRow = Schemas["ReviewItem"];
export type ReviewAction = Schemas["ReviewDecisionActionEnum"];
export interface ReviewScope {
  client: ApiClient;
  identity: SessionIdentity;
}
export type ReviewQuery = NonNullable<operations["review_items_list"]["parameters"]["query"]>;
export const REVIEW_PAGE_SIZE = 25;

/** Scope, authorization and center isolate every observer, including placeholder reads. */
export function reviewListOptions(scope: ReviewScope, query: ReviewQuery) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["reviews", "list", query],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/review-items/", {
          params: { query },
          signal,
        }),
      ),
  });
}

/** Review items have no human record code; the shareable sheet keeps the returned opaque UUID. */
export function reviewDetailOptions(scope: ReviewScope, id: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["reviews", "detail", id],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/review-items/{id}/", {
          params: { path: { id } },
          signal,
        }),
      ),
  });
}
