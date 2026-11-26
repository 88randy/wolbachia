import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { pageTableData } from "../../data-table/table-data";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { WRITE_OFF_TABLE } from "./allocation-table";
import {
  ALLOCATION_PAGE_SIZE,
  courierDirectoryOptions,
  lotDirectoryOptions,
  writeOffListOptions,
} from "./allocation-query";
import type { AllocationScope } from "./allocation-query";
import { useWriteOffColumns } from "./use-write-off-columns";

/** Server paging, ordering and filters live in the URL; rows are never filtered in the browser. */
export function WriteOffTable(props: { scope: AllocationScope; route: string }) {
  const { t } = useTranslation();
  const { scope, route } = props;
  const controller = useTableUrlState(WRITE_OFF_TABLE);
  const query = useQuery(writeOffListOptions(scope, controller.state, route));
  const lots = useQuery(lotDirectoryOptions(scope, route)).data;
  const people = useQuery(courierDirectoryOptions(scope, route)).data;
  const columns = useWriteOffColumns({ lots, people });
  return (
    <>
      <FilterBar controller={controller} />
      <DataTable
        caption={t("allocation.writeOff.tableCaption")}
        columns={columns}
        controller={controller}
        getRowId={(row) => row.id}
        data={pageTableData(query, controller.state.page, ALLOCATION_PAGE_SIZE)}
      />
    </>
  );
}
