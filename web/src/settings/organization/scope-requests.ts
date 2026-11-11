import { unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import type { SessionGuard } from "../../session/use-session-guard";
import type { EditTarget, WorkScope } from "./use-scope-editor";
interface Context {
  client: ApiClient;
  target: EditTarget;
  guard: SessionGuard;
}
export function requestScopeSnapshot({ client, target, guard }: Context) {
  if (target.kind === "role")
    return client
      .GET("/api/v1/roles/{id}/", {
        params: { path: { id: target.record.id } },
        signal: guard.signal,
      })
      .then(unwrap);
  return client
    .GET("/api/v1/memberships/{id}/", {
      params: { path: { id: target.record.id } },
      signal: guard.signal,
    })
    .then(unwrap);
}
interface Change extends Context {
  scope: WorkScope;
  permissions: string[];
  profiles: string[];
  revision: number;
}
export function requestScopeChange({
  client,
  target,
  guard,
  scope,
  permissions,
  profiles,
  revision,
}: Change) {
  if (target.kind === "role")
    return client
      .PUT("/api/v1/roles/{id}/permissions/", {
        params: { path: { id: target.record.id } },
        body: { permissions, scope, expected_revision: revision },
        signal: guard.signal,
      })
      .then(unwrap);
  return client
    .POST("/api/v1/memberships/{id}/change-scope/", {
      params: { path: { id: target.record.id } },
      body: { scope, profiles, expected_revision: revision },
      signal: guard.signal,
    })
    .then(unwrap);
}
