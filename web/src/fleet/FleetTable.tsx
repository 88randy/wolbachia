import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "../data-table/DataTable";
import { FleetListFilters } from "./FleetListFilters";
import { pageTableData } from "../data-table/table-data";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { useFleetScope } from "./use-fleet-scope";
import { fleetListOptions } from "./fleet-query";
import { FLEET_PAGE_SIZE, FLEET_TABLE } from "./fleet-table";
import { useFleetColumns } from "./use-fleet-columns";
import { useFleetCounts } from "./use-fleet-counts";
import { useFleetRowMenu } from "./use-fleet-row-menu";
import { useFleetVoidOf } from "./use-fleet-void-of";
import { useDisplaySettled } from "../session/use-visible-session-state";
import { CardSkeleton } from "../ui/CardSkeleton";
import { useFleetLabels } from "./use-fleet-labels";
export function FleetTable() {
  const { t } = useTranslation();
  const controller = useTableUrlState(FLEET_TABLE);
  const scope = useFleetScope("", controller.state.filters["center"]);
  const query = useQuery(fleetListOptions(scope, controller.state));
  const columns = useFleetColumns();
  const counts = useFleetCounts(scope, controller.state);
  const rowMenu = useFleetRowMenu();
  const labels = useFleetLabels();
  const voidOf = useFleetVoidOf();
  const isSettled = useDisplaySettled(scope.identity.isSettled);
  if (!isSettled) return <CardSkeleton />;
  return (
    <>
      <FleetListFilters controller={controller} counts={counts} rows={query.data?.results ?? []} />
      <DataTable
        caption={t("fleet.table.caption")}
        columns={columns}
        getRowId={(item) => item.id}
        controller={controller}
        rowLink={rowMenu.link}
        rowMenu={rowMenu.menu}
        selection={labels.selection}
        data={pageTableData(query, controller.state.page, FLEET_PAGE_SIZE)}
        voidOf={voidOf}
      />
    </>
  );
}
