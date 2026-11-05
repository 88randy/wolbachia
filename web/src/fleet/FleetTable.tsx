import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { pageTableData } from "../data-table/table-data";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { useFormatDateTime } from "../format/use-format-date-time";
import { useSessionIdentity } from "../session/use-session-identity";
import { useVoidReasonLabel, voidInfoOf } from "../void";
import { fleetListOptions } from "./fleet-query";
import { FLEET_PAGE_SIZE, FLEET_TABLE } from "./fleet-table";
import { useFleetColumns } from "./use-fleet-columns";
import { useFleetAuthor } from "./use-fleet-author";
export function FleetTable() {
  const { t } = useTranslation();
  const controller = useTableUrlState(FLEET_TABLE);
  const client = useApiClient();
  const identity = useSessionIdentity();
  const query = useQuery(fleetListOptions({ client, identity }, controller.state));
  const columns = useFleetColumns();
  const author = useFleetAuthor();
  const format = useFormatDateTime();
  const reasonLabel = useVoidReasonLabel();
  return (
    <>
      <FilterBar controller={controller} />
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
