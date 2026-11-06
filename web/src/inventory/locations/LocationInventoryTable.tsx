import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import type { Schemas } from "@wolbachia/api-client";
import { FilterBar } from "../../data-table/FilterBar";
import { DataTable } from "../../data-table/DataTable";
import { pageTableData } from "../../data-table/table-data";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { INVENTORY_PAGE_SIZE, STOCK_TABLE, MOVEMENT_TABLE } from "../inventory-table";
import { buildTableController } from "../../data-table/table-controller";
import { applyPatch } from "../../data-table/table-state";
import type { SearchPatch } from "../../data-table/table-types";
import { inventoryStockOptions } from "../inventory-query";
import { useInventoryContext } from "../use-inventory-context";
import { useStockColumns } from "./use-stock-columns";
import type { StockRow } from "./use-stock-columns";
import styles from "../inventory.module.css";
interface Props {
  location: Schemas["Location"];
  movements: boolean;
}
/** Parent view/center select the resource boundary; table actions preserve that metadata. */
function useLocationTableUrl(movements: boolean) {
  const base = useTableUrlState(movements ? MOVEMENT_TABLE : STOCK_TABLE);
  const navigate = useNavigate();
  const parsed = {
    state: base.state,
    ignored: base.ignored.filter((key) => !["view", "center"].includes(key)),
  };
  const go = (patch: SearchPatch) => {
    void navigate({ to: ".", search: (previous) => applyPatch(previous, patch) });
  };
  return buildTableController(base.config, parsed, go);
}
function useLocationTable({ location, movements }: Props) {
  const { t } = useTranslation();
  const controller = useLocationTableUrl(movements);
  const query = useQuery(
    inventoryStockOptions(
      useInventoryContext(),
      { location: location.id, movements },
      controller.state,
    ),
  );
  const columns = useStockColumns(location, movements);
  const caption = t(movements ? "inventory.section.movements" : "inventory.section.stock");
  return { controller, query, columns, caption };
}
function stockRowId(row: StockRow) {
  return "id" in row ? row.id : row.lot + ":" + (row.piece_id ?? "none") + ":" + row.unit;
}
export function LocationInventoryTable(props: Props) {
  const { controller, query, columns, caption } = useLocationTable(props);
  return (
    <>
      <div className={styles.filters}>
        <FilterBar controller={controller} />
      </div>
      <DataTable<StockRow>
        embedded
        caption={caption}
        controller={controller}
        columns={columns}
        data={pageTableData<StockRow>(query, controller.state.page, INVENTORY_PAGE_SIZE)}
        getRowId={stockRowId}
      />
    </>
  );
}
