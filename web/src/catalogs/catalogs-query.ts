import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import { invalidateOrgScoped, orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";
import type { QueryClient } from "@tanstack/react-query";
import type { TableState } from "../data-table/table-types";
import { toFilterParams } from "../data-table/table-state";
import { CATALOG_PAGE_SIZE } from "./catalog-table";
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

/** Canonical metadata for capacity/create and the complete atomic reorder id set; never a filtered table. */
export function catalogItemsQueryOptions(
  { client, identity }: CatalogScope,
  slug: string,
  ordering?: "sort",
) {
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "items", slug, ordering],
    queryFn: async ({ signal }) => {
      const items: CatalogItem[] = [];
      let page = 1;
      let hasNext = true;
      while (hasNext) {
        const answer = unwrap(
          await client.GET("/api/v1/catalogs/{catalog_slug}/items/", {
            params: {
              path: { catalog_slug: slug },
              query: { page, page_size: PAGE_SIZE, ordering },
            },
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

interface ItemPage {
  scope: CatalogScope;
  slug: string;
  state: TableState;
}
/** The catalog picker is server-paged too; the unfiltered metadata query still resolves its selected record. */
export function catalogPageOptions({ scope: { client, identity }, state }: Omit<ItemPage, "slug">) {
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "navigation", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/catalogs/", {
          params: {
            query: { page: state.page, page_size: CATALOG_PAGE_SIZE, ...toFilterParams(state) },
          },
          signal,
        }),
      ),
  });
}
/** Visible rows, count and paging always come from the filtered server list. */
export function catalogItemPageOptions({ scope: { client, identity }, slug, state }: ItemPage) {
  return orgScopedQueryOptions(identity, {
    key: [ROOT, "item-page", slug, state],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/catalogs/{catalog_slug}/items/", {
          params: {
            path: { catalog_slug: slug },
            query: { page: state.page, page_size: CATALOG_PAGE_SIZE, ...toFilterParams(state) },
          },
          signal,
        }),
      ),
  });
}

/** A write may change labels, order or availability. */
export function invalidateCatalogs(queryClient: QueryClient) {
  return invalidateOrgScoped(queryClient, ROOT);
}
