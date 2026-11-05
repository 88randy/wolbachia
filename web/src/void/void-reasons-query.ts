import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import { queryOptions } from "@tanstack/react-query";

const PAGE_SIZE = 200;
export const VOID_REASONS_KEY = ["void-reasons"] as const;
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
    items.push(...result.results.filter((item) => item.is_active));
    hasNext = result.next !== null;
    page += 1;
  }
  return items;
}

/** Session cache, cleared with the other organization queries on session changes. */
export function voidReasonsQueryOptions(client: ApiClient) {
  return queryOptions({
    queryKey: VOID_REASONS_KEY,
    queryFn: ({ signal }) => loadVoidReasons(client, signal),
  });
}
