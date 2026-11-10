import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, operations, Schemas } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import type { SessionIdentity } from "../../session/org-scoped-query";
export type Relocation = Schemas["Relocation"];
export type RelocationQuery = NonNullable<operations["relocations_list"]["parameters"]["query"]>;
export interface RelocationScope {
  client: ApiClient;
  identity: SessionIdentity;
  context: string;
  canRead: boolean;
  canDecide: boolean;
}
export const RELOCATIONS = "relocations";
export const RELOCATION_PAGE_SIZE = 25;
/** The API owns filtering and scope; no page scan or invented detail route. */
export function relocationListOptions(scope: RelocationScope, query: RelocationQuery) {
  return orgScopedQueryOptions(scope.identity, {
    key: [RELOCATIONS, scope.context, query],
    queryFn: async ({ signal }) =>
      unwrap(await scope.client.GET("/api/v1/relocations/", { params: { query }, signal })),
  });
}
/** A shareable proposal code resolves to one current authorized source snapshot. */
export function relocationRecordOptions(scope: RelocationScope, code: string) {
  return orgScopedQueryOptions(
    { ...scope.identity, isSettled: scope.identity.isSettled && !!code },
    {
      key: [RELOCATIONS, scope.context, "record", code],
      queryFn: async ({ signal }) => {
        const page = unwrap(
          await scope.client.GET("/api/v1/relocations/", {
            params: { query: { code, include_voided: true, page_size: 1 } },
            signal,
          }),
        );
        return page.count === 1 && page.results[0]?.code === code ? page.results[0] : null;
      },
    },
  );
}
