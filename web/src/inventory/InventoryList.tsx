import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card } from "../ui/Card";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { pageTableData } from "../data-table/table-data";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { useDocumentTitle } from "../shell/use-document-title";
import { inventoryListOptions } from "./inventory-query";
import { INVENTORY_TABLES, INVENTORY_PAGE_SIZE } from "./inventory-table";
import { useInventoryContext } from "./use-inventory-context";
import { useInventoryColumns } from "./use-inventory-columns";
import type { InventoryKind, InventoryRecord } from "./inventory-links";
import page from "../styles/page.module.css";
import { InventoryCreateDialog } from "./InventoryCreateDialog";
import { LocationsMap } from "./locations/LocationsMap";
import type { TableController } from "../data-table/table-types";
import styles from "./inventory.module.css";
function ListControls({ kind, controller }: { kind: InventoryKind; controller: TableController }) {
  return (
    <div className={styles.controls}>
      <div className={styles.actions}>
        <InventoryCreateDialog kind={kind} />
      </div>
      <div className={styles.filters}>
        <FilterBar controller={controller} />
      </div>
    </div>
  );
}
export function InventoryList({ kind }: { kind: InventoryKind }) {
  const { t } = useTranslation();
  const title = t(`inventory.page.${kind}`);
  useDocumentTitle(title);
  const controller = useTableUrlState(INVENTORY_TABLES[kind]);
  const query = useQuery(inventoryListOptions(useInventoryContext(), kind, controller.state));
  const columns = useInventoryColumns(kind);
  const locations = query.data?.results.every((row) => "geometry" in row) ? query.data.results : [];
  return (
    <section className={page.page}>
      <Card title={title} headingLevel={1}>
        <ListControls kind={kind} controller={controller} />
        <DataTable<InventoryRecord>
          caption={title}
          columns={columns}
          getRowId={(row) => row.id}
          controller={controller}
          data={pageTableData<InventoryRecord>(query, controller.state.page, INVENTORY_PAGE_SIZE)}
          embedded
        />
      </Card>
      {kind === "locations" && <LocationsMap locations={locations} />}
    </section>
  );
}
