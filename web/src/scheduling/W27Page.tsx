import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { ListPage } from "../components/templates/ListPage";
import { DataTable } from "../data-table/DataTable";
import { pageTableData } from "../data-table/table-data";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { useFormatCalendarDate } from "../format/use-formatters";
import { useCan } from "../session/use-can";
import { useMe } from "../session/use-me";
import { useSessionIdentity } from "../session/use-session-identity";
import { buttonVariants } from "../ui/button-variants";
import { risksOptions } from "./scheduling-queries";
import { RISK_PAGE_SIZE, RISK_TABLE, RISK_TABLE_SCOPE } from "./risk-table";
import { useRiskColumns } from "./use-risk-columns";
import { WeekSwitcher } from "./WeekSwitcher";
import { todayIn, weekNumberOf, weekStartOf } from "./week-dates";

/** W27: the risk category of every block for a week and where it comes from. */
export function W27Page() {
  const { t } = useTranslation();
  const client = useApiClient();
  const identity = useSessionIdentity();
  const me = useMe();
  const can = useCan();
  const formatDay = useFormatCalendarDate();
  const search: Record<string, string | undefined> = useSearch({ strict: false });
  const week = weekStartOf(
    search["week"] ?? todayIn(me.organization?.timezone ?? "UTC"),
    me.organization?.epi_week ?? "iso",
  );
  const controller = useTableUrlState(RISK_TABLE, RISK_TABLE_SCOPE);
  const query = useQuery(
    risksOptions(client, identity, week, controller.state.page, RISK_PAGE_SIZE),
  );
  const columns = useRiskColumns();
  return (
    <ListPage
      title={t("scheduling.risk.title", { week: weekNumberOf(week) })}
      description={t("scheduling.risk.description", { day: formatDay(week) })}
      actions={
        <>
          <WeekSwitcher week={week} />
          {can("risk_import.apply") && (
            <Link to="/scheduling/risk/import" className={buttonVariants({ variant: "primary" })}>
              <Upload aria-hidden="true" />
              {t("scheduling.risk.import")}
            </Link>
          )}
        </>
      }
    >
      <DataTable
        caption={t("scheduling.risk.caption")}
        columns={columns}
        controller={controller}
        getRowId={(row) => row.id}
        data={pageTableData(query, controller.state.page, RISK_PAGE_SIZE)}
      />
    </ListPage>
  );
}
