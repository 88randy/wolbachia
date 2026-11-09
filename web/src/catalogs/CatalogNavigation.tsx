import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { useSessionIdentity } from "../session/use-session-identity";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { FilterBar } from "../data-table/FilterBar";
import { pageTableData } from "../data-table/table-data";
import { CATALOG_NAV_TABLE, CATALOG_PAGE_SIZE } from "./catalog-table";
import { catalogPageOptions } from "./catalogs-query";
import { CatalogRefreshNotice } from "./CatalogRefreshNotice";
import { CatalogNavigationContent } from "./CatalogNavigationContent";
import { useCatalogRefresh } from "./use-catalog-refresh";
const URL_SCOPE = { prefix: "catalog_" };
/** Navigation filters never change the selected catalog or its retained editor draft. */
export function CatalogNavigation({
  slug,
  isParentError,
}: {
  slug: string;
  isParentError: boolean;
}) {
  const { t } = useTranslation();
  const controller = useTableUrlState(CATALOG_NAV_TABLE, URL_SCOPE);
  const scope = { client: useApiClient(), identity: useSessionIdentity() };
  const query = useQuery(catalogPageOptions({ scope, state: controller.state }));
  const refresh = useCatalogRefresh();
  return (
    <>
      <details open={controller.hasActiveFilters || controller.state.isSortExplicit}>
        <summary>{t("refresh.filters.catalogNavigation")}</summary>
        <FilterBar controller={controller} labelKey="refresh.filters.catalogNavigation" />
      </details>
      <CatalogRefreshNotice error={isParentError ? null : query.error} onRetry={refresh} />
      <CatalogNavigationContent
        slug={slug}
        controller={controller}
        data={pageTableData(query, controller.state.page, CATALOG_PAGE_SIZE)}
      />
    </>
  );
}
