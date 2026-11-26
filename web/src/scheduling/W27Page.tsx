import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { ArrowRight, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { ListPage } from "../components/templates/ListPage";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { pageTableData } from "../data-table/table-data";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { useFormatCalendarDate } from "../format/use-formatters";
import { useCan } from "../session/use-can";
import { useMe } from "../session/use-me";
import { useSessionIdentity } from "../session/use-session-identity";
import { buttonVariants } from "../ui/button-variants";
import { EmptyState } from "../ui/EmptyState";
import { InfoHint } from "../ui/InfoHint";
import { InlineNotice } from "../ui/InlineNotice";
import { risksOptions } from "./scheduling-queries";
import { RISK_PAGE_SIZE, RISK_TABLE, RISK_TABLE_SCOPE } from "./risk-table";
import { useRiskColumns } from "./use-risk-columns";
import { WeekSwitcher } from "./WeekSwitcher";
import { todayIn, weekNumberOf, weekStartOf } from "./week-dates";
import { DEFAULT_TIME_ZONE } from "../format/time-zone";

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
    search["week"] ?? todayIn(me.organization?.timezone ?? DEFAULT_TIME_ZONE),
    me.organization?.epi_week ?? "iso",
  );
  const controller = useTableUrlState(RISK_TABLE, RISK_TABLE_SCOPE);
  const query = useQuery(risksOptions(client, identity, week, controller.state, RISK_PAGE_SIZE));
  const columns = useRiskColumns();
  const canImport = can("risk_import.apply");
  const isEmpty = query.isSuccess && query.data.count === 0;
  const importLink = (variant: "primary" | "secondary") => (
    <Link to="/scheduling/risk/import" className={buttonVariants({ variant })}>
      <Upload aria-hidden="true" />
      {t("scheduling.risk.import")}
    </Link>
  );
  return (
    <ListPage
      title={t("scheduling.risk.title", { week: weekNumberOf(week) })}
      description={
        <>
          {t("scheduling.risk.description", { day: formatDay(week) })}
          <InfoHint text={t("scheduling.risk.hint")} />
        </>
      }
      actions={
        <>
          <WeekSwitcher week={week} />
          {canImport && importLink(isEmpty ? "secondary" : "primary")}
        </>
      }
      notices={
        query.isSuccess &&
        query.data.count > 0 && (
          <InlineNotice
            tone="info"
            action={
              <Link
                to="/scheduling/assignments"
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                {t("scheduling.risk.goAssign")}
                <ArrowRight aria-hidden="true" />
              </Link>
            }
          >
            <p className="font-semibold">{t("scheduling.risk.nextStep")}</p>
          </InlineNotice>
        )
      }
    >
      {isEmpty ? (
        <EmptyState
          kind="noData"
          message={`${t("scheduling.risk.emptyTitle")}. ${t(canImport ? "scheduling.risk.emptyHelp" : "scheduling.risk.emptyReadOnly")}`}
          action={canImport ? importLink("primary") : undefined}
        />
      ) : (
        <>
          <FilterBar controller={controller} />
          <DataTable
            caption={t("scheduling.risk.caption")}
            columns={columns}
            controller={controller}
            getRowId={(row) => row.id}
            data={pageTableData(query, controller.state.page, RISK_PAGE_SIZE)}
          />
        </>
      )}
    </ListPage>
  );
}
