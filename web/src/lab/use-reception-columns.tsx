import { useFormatDateTime } from "../format/use-format-date-time";
import type { DataTableColumn } from "../data-table/table-types";
import type { ReceptionRow } from "./reception-query";
import type { ReceptionView } from "./reception-table";
import type { ReceptionActions } from "./use-reception-command";
import { ReceptionBagCode } from "./ReceptionBagCode";
import { ReceptionRowStatus } from "./ReceptionRowStatus";
import { ReceptionRowActions } from "./ReceptionRowActions";
interface ReceptionColumns {
  view: ReceptionView;
  actions: ReceptionActions;
  isReady: boolean;
}
const BAG_COLUMN: DataTableColumn<ReceptionRow> = {
  id: "bag",
  headerKey: "labReception.table.bag",
  cell: (row) => <ReceptionBagCode row={row} />,
};
export function useReceptionColumns({
  view,
  actions,
  isReady,
}: ReceptionColumns): DataTableColumn<ReceptionRow>[] {
  const format = useFormatDateTime();
  return [
    BAG_COLUMN,
    {
      id: "created_at",
      headerKey: "labReception.table.date",
      cell: (row) => format(row.createdAt),
    },
    {
      id: "status",
      headerKey: "labReception.table.status",
      cell: (row) => <ReceptionRowStatus row={row} />,
    },
    {
      id: "actions",
      headerKey: "labReception.table.actions",
      cell: (row) => (
        <ReceptionRowActions row={row} view={view} actions={actions} isReady={isReady} />
      ),
    },
  ];
}
