import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { pageTableData } from "../../data-table/table-data";
import { PERMITS_PAGE_SIZE } from "./permits-query";
import type { PermitType } from "./permits-query";
import styles from "./permits.module.css";
import { usePermitTypeColumns } from "./use-permit-type-columns";
import type { usePermitTypesScreen } from "./use-permit-types-screen";

const getTypeId = (row: PermitType): string => row.id;

/** Server-paged table of permit types with the shared filter bar. */
interface Props {
  screen: ReturnType<typeof usePermitTypesScreen>;
  actions: ReactNode;
}

export function PermitTypesTable({ screen, actions }: Props) {
  const { t } = useTranslation();
  const columns = usePermitTypeColumns();
  const { controller, query } = screen;
  return (
    <div className={styles.content}>
      <FilterBar controller={controller} actions={actions} />
      <DataTable
        caption={t("permits.types.caption")}
        columns={columns}
        getRowId={getTypeId}
        controller={controller}
        data={pageTableData(query, controller.state.page, PERMITS_PAGE_SIZE)}
      />
    </div>
  );
}
