/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative column list. */
import { useMemo } from "react";
import { useCenterColumns } from "../../data-table/center-column";
import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { PermitBlockers } from "../permits/PermitBlockers";
import { DeviceStatusPill } from "./DeviceStatusPill";
import type { ReleaseDevice } from "./devices-query";

/** Columns of W47: device, quadrant, source lot, status, its conditions and the date it was added. */
export function useDeviceColumns(): readonly DataTableColumn<ReleaseDevice>[] {
  const format = useFormatDateTime();
  const columns = useMemo<DataTableColumn<ReleaseDevice>[]>(
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
  return useCenterColumns(columns, (row) => row.center, { after: "code" });
}
