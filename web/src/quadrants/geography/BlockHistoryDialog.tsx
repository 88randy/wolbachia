import { FilterBar } from "../../data-table/FilterBar";
import { useHistoryController } from "./use-history-controller";
import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { useModalDialog } from "../../session/use-modal-dialog";
import { DataTable } from "../../data-table/DataTable";
import { pageTableData } from "../../data-table/table-data";
import { blockHistoryOptions } from "./geography-query";
import type { GeographyScope } from "./use-w-15";
import { PAGE_SIZE } from "./geography-table";
import { useBlockHistoryColumns } from "./use-block-history-columns";
import styles from "./geography.module.css";
interface Props {
  scope: GeographyScope;
  block: Schemas["Block"];
  onClose: () => void;
}
export function BlockHistoryDialog({ scope, block, onClose }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const ref = useModalDialog("button");
  const history = useHistoryController({ isPoint: false, userId: scope.me.user.id, onClose });
  const query = useQuery(blockHistoryOptions(scope, block.id, history.controller.state));
  const columns = useBlockHistoryColumns();
  const table = {
    columns,
    controller: history.controller,
    data: pageTableData(query, history.controller.state.page, PAGE_SIZE),
    getRowId: (row: Schemas["BlockVersion"]) => row.id,
  };
  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby={id} onCancel={history.close}>
      <h2 id={id}>
        {t("geography.history.title")}
        {" \u00b7 "}
        {block.code}
      </h2>
      <button type="button" onClick={history.close}>
        {t("common.actions.close")}
      </button>
      <FilterBar controller={history.controller} labelKey="refresh.filters.history" />
      <DataTable caption={t("geography.history.title")} {...table} />
    </dialog>
  );
}
