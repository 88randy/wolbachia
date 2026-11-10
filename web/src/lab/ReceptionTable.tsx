import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { pageTableData } from "../data-table/table-data";
import type { TableController } from "../data-table/table-types";
import { receptionListOptions } from "./reception-query";
import { useReceptionScope } from "./use-reception-scope";
import { RECEPTION_PAGE_SIZE } from "./reception-table";
import type { ReceptionView } from "./reception-table";
import type { ReceptionActions } from "./use-reception-command";
import { useReceptionColumns } from "./use-reception-columns";
import { ReceptionRowDetails } from "./ReceptionRowDetails";
import styles from "./reception.module.css";
export function ReceptionTable({
  controller,
  view,
  actions,
}: {
  controller: TableController;
  view: ReceptionView;
  actions: ReceptionActions;
}) {
  const { t } = useTranslation();
  const scope = useReceptionScope();
  const query = useQuery(receptionListOptions(scope, controller.state, view));
  const isReady =
    !query.isPlaceholderData && !query.isFetching && !query.isError && scope.identity.isSettled;
  const columns = useReceptionColumns({ view, actions, isReady });
  return (
    <div className={styles.filters}>
      <FilterBar controller={controller} />
      <DataTable
        caption={t(`labReception.table.${view}`)}
        columns={columns}
        controller={controller}
        getRowId={(row) => row.id}
        data={pageTableData(query, controller.state.page, RECEPTION_PAGE_SIZE)}
        renderDetail={(row) => <ReceptionRowDetails row={row} />}
      />
    </div>
  );
}
