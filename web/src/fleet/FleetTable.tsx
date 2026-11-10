import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "../data-table/DataTable";
import { FleetFilters } from "./FleetFilters";
import { pageTableData } from "../data-table/table-data";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { useFormatDateTime } from "../format/use-format-date-time";
import { useFleetScope } from "./use-fleet-scope";
import { useVoidReasonLabel, voidInfoOf } from "../void";
import { fleetListOptions } from "./fleet-query";
import { FLEET_PAGE_SIZE, FLEET_TABLE } from "./fleet-table";
import { useFleetColumns } from "./use-fleet-columns";
import { useFleetAuthor } from "./use-fleet-author";
import { useDisplaySettled } from "../session/use-visible-session-state";
import { CardSkeleton } from "../ui/CardSkeleton";
export function FleetTable() {
  const { t } = useTranslation();
  const controller = useTableUrlState(FLEET_TABLE);
  const scope = useFleetScope("", controller.state.filters["center"]);
  const query = useQuery(fleetListOptions(scope, controller.state));
  const columns = useFleetColumns();
  const author = useFleetAuthor();
  const format = useFormatDateTime();
  const reasonLabel = useVoidReasonLabel();
  const isSettled = useDisplaySettled(scope.identity.isSettled);
  if (!isSettled) return <CardSkeleton />;
  return (
    <>
      <FleetFilters controller={controller} />
      <DataTable
        caption={t("fleet.table.caption")}
        columns={columns}
        getRowId={(item) => item.id}
        controller={controller}
        data={pageTableData(query, controller.state.page, FLEET_PAGE_SIZE)}
        voidOf={(item) => voidInfoOf(item, author, { formatWhen: format, reasonLabel })}
      />
    </>
  );
}
