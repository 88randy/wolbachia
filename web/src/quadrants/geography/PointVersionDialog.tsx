import { FilterBar } from "../../data-table/FilterBar";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { DataTable } from "../../data-table/DataTable";
import { pageTableData } from "../../data-table/table-data";
import { pointHistoryOptions } from "./geography-query";
import { PAGE_SIZE } from "./geography-table";
import { PointRelocationForm } from "./PointRelocationForm";
import { usePointHistoryColumns } from "./use-point-history-columns";
import { useHistoryController } from "./use-history-controller";
import { usePointRetirement } from "./use-point-retirement";
import { GeographyDialog } from "./GeographyDialog";
import type { GeographyScope } from "./use-w-15";
interface Props {
  scope: GeographyScope;
  point: Schemas["SamplingPoint"];
  quadrant: string;
  onClose: () => void;
}
export function PointVersionDialog({ scope, point, quadrant, onClose }: Props) {
  const { t } = useTranslation();
  const history = useHistoryController({ isPoint: true, userId: scope.me.user.id, onClose });
  const query = useQuery(pointHistoryOptions(scope, point.id, history.controller.state));
  const columns = usePointHistoryColumns();
  const retired = usePointRetirement(scope, quadrant);
  const table = {
    columns,
    controller: history.controller,
    data: pageTableData(query, history.controller.state.page, PAGE_SIZE),
    getRowId: (row: Schemas["PointVersion"]) => row.id,
    voidOf: (row: Schemas["PointVersion"]) => retired({ ...point, current_version: row }),
  };
  const title = t("geography.history.point") + " · " + point.code;
  return (
    <GeographyDialog title={title} onClose={history.close}>
      <button type="button" onClick={history.close}>
        {t("common.actions.close")}
      </button>
      <FilterBar controller={history.controller} labelKey="refresh.filters.history" />
      <DataTable caption={t("geography.history.point")} {...table} />
      {scope.canCreatePoint && (
        <PointRelocationForm key={point.id} {...{ scope, point, quadrant }} />
      )}
    </GeographyDialog>
  );
}
