import { Pager } from "../data-table/Pager";
import { TableEmpty } from "../data-table/TableEmpty";
import { TableSkeleton } from "../ui/TableSkeleton";
import type { TableController, TableData } from "../data-table/table-types";
import type { Catalog } from "./catalogs-query";
import { CatalogTabs } from "./CatalogTabs";
interface Props {
  data: TableData<Catalog>;
  controller: TableController;
  slug: string;
}
/** Keep the existing navigation mounted while its own server query refreshes. */
export function CatalogNavigationContent({ data, controller, slug }: Props) {
  if (data.error && data.rows.length === 0) return null;
  if (data.isLoading) return <TableSkeleton columns={1} />;
  if (data.rows.length === 0)
    return (
      <TableEmpty
        hasActiveFilters={controller.hasActiveFilters}
        onClearFilters={controller.clearFilters}
      />
    );
  return (
    <>
      <CatalogTabs catalogs={data.rows} slug={slug} />
      {data.paging && (
        <Pager
          paging={data.paging}
          controller={controller}
          labelKey="refresh.filters.catalogPager"
        />
      )}
    </>
  );
}
