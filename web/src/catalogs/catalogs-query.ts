import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import { queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
export type Catalog = Schemas["Catalog"];
export type CatalogItem = Schemas["CatalogItem"];
const ROOT = "catalogs";
const PAGE_SIZE = 200;

/** All W63 keys live here, ready for the later orgScopedQueryOptions migration. */
export function catalogsQueryOptions(client: ApiClient) {
  return queryOptions({
    queryKey: [ROOT, "list"],
    queryFn: async ({ signal }) => {
      const catalogs: Catalog[] = [];
      let page = 1;
      let hasNext = true;
      while (hasNext) {
        const answer = unwrap(
          await client.GET("/api/v1/catalogs/", {
            params: { query: { page, page_size: PAGE_SIZE } },
            signal,
          }),
        );
        catalogs.push(...answer.results);
        hasNext = Boolean(answer.next);
        page += 1;
      }
      return catalogs;
    },
  });
}

/** Read every page in server order; the table has no paging so swaps see all active neighbors. */
export function catalogItemsQueryOptions(client: ApiClient, slug: string) {
  return queryOptions({
    queryKey: [ROOT, "items", slug],
    queryFn: async ({ signal }) => {
      const items: CatalogItem[] = [];
      let page = 1;
      let hasNext = true;
      while (hasNext) {
        const answer = unwrap(
          await client.GET("/api/v1/catalogs/{catalog_slug}/items/", {
            params: { path: { catalog_slug: slug }, query: { page, page_size: PAGE_SIZE } },
            signal,
          }),
        );
        items.push(...answer.results);
        hasNext = Boolean(answer.next);
        page += 1;
      }
      return items;
    },
  });
}

/** A write may change labels, order or availability. */
export function invalidateCatalogs(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: [ROOT] });
}
