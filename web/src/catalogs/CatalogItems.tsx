import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import { useSessionIdentity } from "../session/use-session-identity";
import {
  catalogEditorKey,
  catalogItemsQueryOptions,
  catalogItemPageOptions,
} from "./catalogs-query";
import type { Catalog } from "./catalogs-query";
import { CatalogEditor } from "./CatalogEditor";
import { useCatalogTable } from "./use-catalog-table";
import { pageTableData } from "../data-table/table-data";
import { CATALOG_PAGE_SIZE } from "./catalog-table";
import { CatalogRefreshNotice } from "./CatalogRefreshNotice";
/** Same-identity placeholder rows survive tab requests; writes wait for the target snapshot. */
export function CatalogItems({ catalog }: { catalog: Catalog }) {
  const scope = { client: useApiClient(), identity: useSessionIdentity() };
  const table = useCatalogTable();
  const ordering = table.canReorder && table.controller.state.isSortExplicit ? "sort" : undefined;
  const canonical = useQuery(catalogItemsQueryOptions(scope, catalog.slug, ordering));
  const query = useQuery(
    catalogItemPageOptions({ scope, slug: catalog.slug, state: table.controller.state }),
  );
  const isReady =
    query.data !== undefined &&
    !query.isPlaceholderData &&
    query.error === null &&
    canonical.data !== undefined &&
    !canonical.isPlaceholderData &&
    canonical.error === null;
  return (
    <>
      <CatalogRefreshNotice error={canonical.error} onRetry={canonical.refetch} />
      <CatalogEditor
        key={catalogEditorKey(scope.identity, catalog.slug)}
        catalog={catalog}
        items={pageTableData(query, table.controller.state.page, CATALOG_PAGE_SIZE)}
        canonicalRows={canonical.data ?? []}
        table={table}
        isReady={isReady}
      />
    </>
  );
}
