import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";

const PAGE_SIZE = 200;
export const VOID_REASONS_RESOURCE = "void-reasons";
export type VoidReasonItem = Schemas["CatalogItem"];

/** Read every page in API order, including Other when inactive items fill earlier pages. */
async function loadVoidReasons(client: ApiClient, signal: AbortSignal) {
  const items: VoidReasonItem[] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    const result = unwrap(
      await client.GET("/api/v1/catalogs/{catalog_slug}/items/", {
        params: { path: { catalog_slug: "void-reason" }, query: { page, page_size: PAGE_SIZE } },
        signal,
      }),
    );
    items.push(...result.results);
    hasNext = result.next !== null;
    page += 1;
  }
  return items;
}

/** Org-scoped (#82): the catalog is per organization, so the key carries the session identity. */
export function voidReasonsQueryOptions(client: ApiClient, identity: SessionIdentity) {
  return orgScopedQueryOptions(identity, {
    key: [VOID_REASONS_RESOURCE],
    queryFn: ({ signal }) => loadVoidReasons(client, signal),
  });
}
