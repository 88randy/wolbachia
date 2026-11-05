import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { pageTableData } from "../data-table/table-data";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { useFormatDateTime } from "../format/use-format-date-time";
import { useMe } from "../session/use-me";
import { voidInfoOf } from "../void";
import { fleetListOptions } from "./fleet-query";
import { FLEET_PAGE_SIZE, FLEET_TABLE } from "./fleet-table";
import { useFleetColumns } from "./use-fleet-columns";
import { useFleetAuthor } from "./use-fleet-author";
export function FleetTable() {
  const { t } = useTranslation();
  const controller = useTableUrlState(FLEET_TABLE);
  const query = useQuery(fleetListOptions(useApiClient(), useMe(), controller.state));
  const columns = useFleetColumns();
  const author = useFleetAuthor();
  const format = useFormatDateTime();
  return (
    <>
      <FilterBar controller={controller} />
      <DataTable
        caption={t("fleet.table.caption")}
        columns={columns}
        getRowId={(item) => item.id}
        controller={controller}
        data={pageTableData(query, controller.state.page, FLEET_PAGE_SIZE)}
        voidOf={(item) => voidInfoOf(item, author, format)}
      />
    </>
  );
}
