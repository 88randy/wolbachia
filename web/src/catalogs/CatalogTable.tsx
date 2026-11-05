import { useTranslation } from "react-i18next";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { useCatalogTable } from "./use-catalog-table";
import { useCatalogColumns } from "./use-catalog-columns";
import type { CatalogItem } from "./catalogs-query";
import type { TableData } from "../data-table/table-types";
import styles from "./catalogs.module.css";
const rowId = (item: CatalogItem) => item.id;
/** All fetched rows participate in reorder; only the availability toggle filters presentation. */
export function CatalogTable({ items }: { items: TableData<CatalogItem> }) {
  const { t } = useTranslation();
  const table = useCatalogTable();
  const columns = useCatalogColumns();
  const rows = items.rows.filter((item) => table.isIncludingDeactivated || item.is_active);
  return (
    <>
      <FilterBar controller={table.controller} />
      <label className={styles.toggle}>
        <input
          type="checkbox"
          data-catalog-include=""
          checked={table.isIncludingDeactivated}
          onChange={(event) => {
            table.setInclude(event.target.checked);
          }}
        />
        {t("catalogs.table.include")}
      </label>
      <DataTable
        caption={t("catalogs.page.title")}
        columns={columns}
        getRowId={rowId}
        controller={table.controller}
        data={{ ...items, rows }}
      />
    </>
  );
}
