/* eslint-disable max-lines-per-function -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { StatusPill } from "../../ui/StatusPill";
import { ACCESS_TABLE, accessOptions } from "../reg-queries";
import type { AccessRow } from "../reg-queries";
import { FilterBar } from "../../data-table/FilterBar";
import { useRegList } from "../use-reg-list";

/** Who viewed or changed personal data: read only, names instead of ids. */
export function AccessTab() {
  const { t } = useTranslation();
  const formatDateTime = useFormatDateTime();
  const { controller, data } = useRegList(ACCESS_TABLE, accessOptions);
  const columns: DataTableColumn<AccessRow>[] = [
    {
      id: "when",
      headerKey: "regulatory.access.col.when",
      cell: (row) => formatDateTime(row.created_at),
    },
    {
      id: "who",
      headerKey: "regulatory.access.col.who",
      cell: (row) => row.actor_name ?? t("regulatory.access.system"),
    },
    {
      id: "action",
      headerKey: "regulatory.access.col.action",
      cell: (row) => t(`regulatory.access.action.${row.action}`),
    },
    {
      id: "target",
      headerKey: "regulatory.access.col.target",
      cell: (row) => row.target_name ?? t("regulatory.common.none"),
    },
    {
      id: "origin",
      headerKey: "regulatory.access.col.origin",
      cell: (row) => t(`regulatory.access.origin.${row.origin}`),
    },
    {
      id: "result",
      headerKey: "regulatory.access.col.result",
      cell: (row) => (
        <StatusPill tone={row.result === "success" ? "success" : "critical"}>
          {t(`regulatory.access.result.${row.result}`)}
        </StatusPill>
      ),
    },
  ];
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <FilterBar controller={controller} />
      <DataTable
        caption={t("regulatory.access.tab.access")}
        columns={columns}
        getRowId={(row) => row.id}
        controller={controller}
        data={data}
      />
    </div>
  );
}
