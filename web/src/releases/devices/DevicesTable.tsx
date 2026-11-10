import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../../api/ApiClientProvider";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { pageTableData } from "../../data-table/table-data";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { useCan } from "../../session/use-can";
import { useSessionIdentity } from "../../session/use-session-identity";
import { PERMIT_MANAGE } from "../permits/permissions";
import { DeviceRowAction } from "./DeviceRowAction";
import { DEVICES_PAGE_SIZE, DEVICES_TABLE, devicesOptions } from "./devices-query";
import type { ReleaseDevice } from "./devices-query";
import { useDeviceColumns } from "./use-device-columns";

const getDeviceId = (row: ReleaseDevice): string => row.id;

/** Filter bar and server-paged table of release devices, with the row action to change status. */
export function DevicesTable({ onChange }: { onChange: (device: ReleaseDevice) => void }) {
  const { t } = useTranslation();
  const canManage = useCan()(PERMIT_MANAGE);
  const controller = useTableUrlState(DEVICES_TABLE);
  const query = useQuery(devicesOptions(useApiClient(), useSessionIdentity(), controller.state));
  return (
    <>
      <FilterBar controller={controller} />
      <DataTable
        caption={t("releases.devices.caption")}
        columns={useDeviceColumns()}
        getRowId={getDeviceId}
        controller={controller}
        data={pageTableData(query, controller.state.page, DEVICES_PAGE_SIZE)}
        rowActions={(row) => (
          <DeviceRowAction
            canManage={canManage}
            onChange={() => {
              onChange(row);
            }}
          />
        )}
      />
    </>
  );
}
