import { centerIdentity } from "../centers/center-filter";
import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, operations, Schemas } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";
export type Incident = Schemas["ReportedIncident"];
export type IncidentQuery = NonNullable<operations["incidents_list"]["parameters"]["query"]>;
export interface IncidentScope {
  client: ApiClient;
  identity: SessionIdentity;
}
export const INCIDENT_PAGE_SIZE = 25;
/** All workspace reads use the session-owned actor, organization and authorization key. */
export function incidentListOptions(scope: IncidentScope, query: IncidentQuery) {
  return orgScopedQueryOptions(centerIdentity(scope.identity, query.center), {
    key: ["incidents", "list", query],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/incidents/", {
          params: { query: { ...query, kind: "reported" } },
          signal,
        }),
      ),
  });
}
/** Resolve the shareable human code with an exact scoped lookup before requesting its UUID. */
export function incidentDetailOptions(scope: IncidentScope, code: string) {
  return {
    ...orgScopedQueryOptions(scope.identity, {
      key: ["incidents", "detail", code],
      queryFn: async ({ signal }) => {
        const page = unwrap(
          await scope.client.GET("/api/v1/incidents/", {
            params: { query: { kind: "reported", code, page_size: 1 } },
            signal,
          }),
        );
        const match = page.results.find(
          (row): row is Incident => "code" in row && row.code === code,
        );
        if (!match) return null;
        const record = unwrap(
          await scope.client.GET("/api/v1/incidents/{id}/", {
            params: { path: { id: match.id } },
            signal,
          }),
        );
        return record.code === code && record.id === match.id ? record : null;
      },
    }),
    placeholderData: undefined,
  };
}
