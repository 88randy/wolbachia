import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import { pageTableData } from "../../data-table/table-data";
import type { TableController } from "../../data-table/table-types";
import { historyOptions } from "./geography-query";
import type { GeographyScope } from "./use-w-15";
import { PAGE_SIZE } from "./geography-table";
import { useHistoryColumns } from "./use-history-columns";
interface Props {
  scope: GeographyScope;
  quadrant: string;
  controller: TableController;
}
export function QuadrantHistory({ scope, quadrant, controller }: Props) {
  const { t } = useTranslation();
  const columns = useHistoryColumns();
  const query = useQuery(historyOptions(scope, quadrant, controller.state.page));
  return (
    <DataTable
      caption={t("geography.history.title")}
      getRowId={(row) => row.id}
      columns={columns}
      controller={controller}
      data={pageTableData(query, controller.state.page, PAGE_SIZE)}
    />
  );
}
