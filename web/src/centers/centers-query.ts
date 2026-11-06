import { unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";
const PAGE_SIZE = 200;
/** Read every server page of this bounded picker; do not mistake a partial page for a revoked id. */
export function centersOptions(client: ApiClient, identity: SessionIdentity) {
  return orgScopedQueryOptions(identity, {
    key: ["centers"],
    queryFn: async ({ signal }) => {
      const centers = [];
      let page = 1;
      for (;;) {
        const answer = unwrap(
          await client.GET("/api/v1/centers/", {
            params: { query: { page, page_size: PAGE_SIZE } },
            signal,
          }),
        );
        centers.push(...answer.results);
        if (!answer.next) return centers;
        page += 1;
      }
    },
  });
}
