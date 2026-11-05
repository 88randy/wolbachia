import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import { PointVersionDialog } from "./PointVersionDialog";
import { usePointsTable } from "./use-points-table";
import type { PointsTableOptions } from "./use-points-table";
export function PointsTable(options: PointsTableOptions) {
  const { t } = useTranslation();
  const list = usePointsTable(options);
  const dialog = { ...options, onClose: list.close };
  return (
    <>
      <p>{t("geography.points.fixed")}</p>
      <DataTable caption={t("geography.points.title")} {...list.table} />
      {list.point && <PointVersionDialog {...dialog} point={list.point} />}
    </>
  );
}
