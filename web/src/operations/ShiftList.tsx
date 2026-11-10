import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useApiClient } from "../api/ApiClientProvider";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { pageTableData } from "../data-table/table-data";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { useSessionIdentity } from "../session/use-session-identity";
import { useDocumentTitle } from "../shell/use-document-title";
import page from "../styles/page.module.css";
import { shiftsOptions } from "./shifts-query";
import { SHIFTS_TABLE, SHIFT_PAGE_SIZE } from "./shifts-table";
import { useShiftColumns } from "./use-shift-columns";
const getId = (shift: Schemas["Shift"]) => shift.id;
/** W29 entry list. W28 live tracking and W30 source review are separate screens. */
export function ShiftList() {
  const { t } = useTranslation();
  useDocumentTitle(t("shift.page.title"));
  const client = useApiClient();
  const identity = useSessionIdentity();
  const controller = useTableUrlState(SHIFTS_TABLE);
  const query = useQuery(shiftsOptions(client, identity, controller.state));
  const columns = useShiftColumns();
  return (
    <section className={page.page}>
      <h1 className={page.title}>{t("shift.page.title")}</h1>
      <p className={page.body}>{t("shift.page.listHint")}</p>
      <FilterBar controller={controller} />
      <DataTable
        caption={t("shift.page.title")}
        columns={columns}
        getRowId={getId}
        controller={controller}
        data={pageTableData(query, controller.state.page, SHIFT_PAGE_SIZE)}
      />
    </section>
  );
}
