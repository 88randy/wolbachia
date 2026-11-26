import { unwrap } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { LabScope } from "./lab-query";

export type NameKind = "center" | "quadrant" | "location" | "lot" | "bag" | "user";

interface NameRequest {
  scope: LabScope;
  kind: NameKind;
  id: string;
}

async function labelOf({ scope, kind, id }: NameRequest, signal: AbortSignal) {
  const { client } = scope;
  const path = { path: { id } };
  switch (kind) {
    case "center": {
      const row = unwrap(await client.GET("/api/v1/centers/{id}/", { params: path, signal }));
      return row.name || row.code;
    }
    case "quadrant":
      return unwrap(await client.GET("/api/v1/lookups/quadrants/{id}/", { params: path, signal }))
        .code;
    case "location": {
      const row = unwrap(await client.GET("/api/v1/locations/{id}/", { params: path, signal }));
      return row.name || row.code;
    }
    case "lot":
      return unwrap(await client.GET("/api/v1/lots/{id}/", { params: path, signal })).code;
    case "bag":
      return unwrap(await client.GET("/api/v1/bags/{id}/", { params: path, signal })).code;
    case "user":
      return unwrap(await client.GET("/api/v1/lookups/users/{id}/", { params: path, signal }))
        .display_name;
  }
}

/** Resolves one record id to the label people read (never the id itself). Cached per id. */
export function nameOptions(scope: LabScope, kind: NameKind, id: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["lab", "name", kind, id],
    queryFn: ({ signal }) => labelOf({ scope, kind, id }, signal),
  });
}
