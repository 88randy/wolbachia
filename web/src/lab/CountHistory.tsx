import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { pageTableData } from "../data-table/table-data";
import { historyOptions, PAGE_SIZE } from "./lab-query";
import type { LabScope } from "./lab-query";
import { HISTORY_TABLE } from "./lab-table";
import { useHistoryColumns } from "./use-history-columns";
export function CountHistory({ scope, draftKey }: { scope: LabScope; draftKey: string }) {
  const { t } = useTranslation();
  const controller = useTableUrlState(HISTORY_TABLE);
  const query = useQuery(historyOptions(scope, controller.state));
  const columns = useHistoryColumns(scope, draftKey);
  return <><FilterBar controller={controller} /><DataTable caption={t("lab.history.title")} columns={columns} getRowId={(count) => count.id}
    controller={controller} data={pageTableData(query, controller.state.page, PAGE_SIZE)}
    renderDetail={(count) => count.voided ? <p>{t("lab.history.retained")}</p> : null} /></>;
}
