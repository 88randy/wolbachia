import { useCatalogRows } from "./use-catalog-rows";
import { useTranslation } from "react-i18next";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { ReorderProvider } from "../data-table/ReorderProvider";
import { InlineNotice } from "../ui/InlineNotice";
import type { useCatalogTable } from "./use-catalog-table";
import { useCatalogColumns } from "./use-catalog-columns";
import type { CatalogItem } from "./catalogs-query";
import type { TableData } from "../data-table/table-types";
const rowId = (item: CatalogItem) => item.id;
interface Props {
  items: TableData<CatalogItem>;
  table: ReturnType<typeof useCatalogTable>;
}
/** Visible rows are server-paged; a complete canonical snapshot owns every reorder. */
export function CatalogTable({ items, table }: Props) {
  const { t } = useTranslation();
  const columns = useCatalogColumns();
  const { rows, drag, reorder, resetKey } = useCatalogRows(items);
  return (
    <>
      <FilterBar controller={table.controller} />
      <CatalogReorderNotice canReorder={table.canReorder} />
      <ReorderProvider
        items={reorder}
        resetKey={resetKey}
        onStart={drag.start}
        onEnd={drag.end}
        onMove={drag.move}
      >
        <DataTable
          caption={t("catalogs.page.title")}
          columns={columns}
          getRowId={rowId}
          controller={table.controller}
          data={{ ...items, rows }}
        />
      </ReorderProvider>
    </>
  );
}

function CatalogReorderNotice({ canReorder }: { canReorder: boolean }) {
  const { t } = useTranslation();
  return canReorder ? null : (
    <InlineNotice tone="info">{t("refresh.filters.reorderFiltered")}</InlineNotice>
  );
}
