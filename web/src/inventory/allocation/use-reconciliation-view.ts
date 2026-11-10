import { useQuery } from "@tanstack/react-query";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { pageTableData } from "../../data-table/table-data";
import { RECONCILIATION_TABLE } from "./allocation-table";
import {
  ALLOCATION_PAGE_SIZE,
  RECONCILIATIONS_ROUTE,
  courierDirectoryOptions,
  lotDirectoryOptions,
  reconciliationListOptions,
} from "./allocation-query";
import type { AllocationScope } from "./allocation-query";
import { reconciliationRows } from "./reconciliation-equation";

export function useReconciliationView(scope: AllocationScope) {
  const controller = useTableUrlState(RECONCILIATION_TABLE);
  const query = useQuery(reconciliationListOptions(scope, controller.state));
  const lots = useQuery(lotDirectoryOptions(scope, RECONCILIATIONS_ROUTE));
  const couriers = useQuery(courierDirectoryOptions(scope, RECONCILIATIONS_ROUTE));
  const rows = reconciliationRows(query.data?.results ?? []);
  const data = pageTableData(
    { ...query, data: query.data && { count: query.data.count, results: rows } },
    controller.state.page,
    ALLOCATION_PAGE_SIZE,
  );
  return { controller, data, lots: lots.data, couriers: couriers.data };
}
