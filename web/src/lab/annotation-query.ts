import { unwrap } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { LabScope } from "./lab-query";

export function annotationOptions(scope: LabScope, countId: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["lab", "annotation", countId],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/egg-counts/{id}/annotation/", {
          params: { path: { id: countId } },
          signal,
        }),
      ),
  });
}

export function annotationImageOptions(scope: LabScope, uploadId: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["lab", "annotation-image", uploadId],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/attachments/{id}/download/", {
          params: { path: { id: uploadId } },
          parseAs: "blob",
          signal,
        }),
      ),
  });
}
