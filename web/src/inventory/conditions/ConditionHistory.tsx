import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { pageTableData } from "../../data-table/table-data";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { useInventoryContext } from "../use-inventory-context";
import { conditionReadingsOptions } from "./condition-queries";
import { CONDITION_TABLE } from "./condition-table";
import { useConditionColumns } from "./use-condition-columns";
import { ConditionChart } from "./ConditionChart";
import styles from "../inventory.module.css";

export function ConditionHistory({ lot }: { lot: string }) {
  const { t } = useTranslation();
  const scope = useInventoryContext();
  const controller = useTableUrlState(CONDITION_TABLE, {
    ignoredPrefixes: ["center", "custody_location"],
  });
  const query = useQuery(conditionReadingsOptions(scope, lot, controller.state));
  const columns = useConditionColumns();
  return (
    <>
      <ConditionChart query={query} />
      <Card title={t("conditions.section.history")}>
        <div className={styles.filters}>
          <FilterBar controller={controller} />
        </div>
        <DataTable
          caption={t("conditions.section.history")}
          columns={columns}
          getRowId={(row) => row.id}
          controller={controller}
          data={pageTableData(query, controller.state.page, CONDITION_TABLE.pageSize)}
        />
      </Card>
    </>
  );
}
