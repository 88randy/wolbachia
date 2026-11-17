import { unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import type { LabScope } from "../lab-query";

export type BagTrace = Schemas["BagTrace"];

/** The whole origin of a bag in one call, addressed by its human code (never an id). */
export function traceOptions(scope: LabScope, code: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["lab", "trace", code],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/bags/{bag_code}/trace/", {
          params: { path: { bag_code: code } },
          signal,
        }),
      ),
  });
}
