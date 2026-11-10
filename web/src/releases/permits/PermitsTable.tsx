import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { pageTableData } from "../../data-table/table-data";
import type { TableController } from "../../data-table/table-types";
import { PERMITS_PAGE_SIZE } from "./permits-query";
import type { Permit } from "./permits-query";
import styles from "./permits.module.css";
import { usePermitColumns } from "./use-permit-columns";
import type { usePermitsScreen } from "./use-permits-screen";

const getPermitId = (row: Permit): string => row.id;

interface Props {
  controller: TableController;
  query: ReturnType<typeof usePermitsScreen>["query"];
}

/** Server-paged table of permits with the shared filter bar. */
export function PermitsTable({ controller, query }: Props) {
  const { t } = useTranslation();
  return (
    <div className={styles.content}>
      <FilterBar controller={controller} />
      <DataTable
        caption={t("permits.list.caption")}
        columns={usePermitColumns()}
        getRowId={getPermitId}
        controller={controller}
        data={pageTableData(query, controller.state.page, PERMITS_PAGE_SIZE)}
      />
    </div>
  );
}
