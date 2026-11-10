import { useMemo } from "react";
import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { PermitBlockers } from "../permits/PermitBlockers";
import { DeviceStatusPill } from "./DeviceStatusPill";
import type { ReleaseDevice } from "./devices-query";

/** Columns of W47: device, quadrant, source lot, status, its conditions and the date it was added. */
export function useDeviceColumns(): readonly DataTableColumn<ReleaseDevice>[] {
  const format = useFormatDateTime();
  return useMemo(
    () => [
      { id: "code", headerKey: "releases.devices.column.code", cell: (row) => row.code },
      {
        id: "quadrant",
        headerKey: "releases.devices.column.quadrant",
        cell: (row) => row.quadrant_code,
      },
      { id: "lot", headerKey: "releases.devices.column.lot", cell: (row) => row.source_lot_code },
      {
        id: "status",
        headerKey: "releases.devices.column.status",
        cell: (row) => <DeviceStatusPill status={row.status} />,
      },
      {
        id: "conditions",
        headerKey: "releases.devices.column.conditions",
        cell: (row) => <PermitBlockers blockers={row.blocked_by} />,
      },
      {
        id: "created_at",
        headerKey: "releases.devices.column.created",
        cell: (row) => format(row.created_at),
      },
    ],
    [format],
  );
}
