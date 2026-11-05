import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import { invalidateOrgScoped, orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";
import type { QueryClient } from "@tanstack/react-query";
export type Catalog = Schemas["Catalog"];
export type CatalogItem = Schemas["CatalogItem"];
const ROOT = "catalogs";
const PAGE_SIZE = 200;

/** The caller supplies the session-owned identity; queries never read it themselves. */
export interface CatalogScope {
  client: ApiClient;
  identity: SessionIdentity;
}

/** Remount the editor and all its drafts only when the user, organization or catalog changes. */
export function catalogEditorKey(identity: SessionIdentity, slug: string): string {
  return `${identity.userId}:${identity.organizationSlug}:${slug}`;
}

/** All W63 keys are org-scoped and live here, together with their invalidation. */
export function catalogsQueryOptions({ client, identity }: CatalogScope) {
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "list"],
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
export function catalogItemsQueryOptions({ client, identity }: CatalogScope, slug: string) {
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "items", slug],
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
  return invalidateOrgScoped(queryClient, ROOT);
}
