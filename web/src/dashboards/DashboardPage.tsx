/* eslint-disable max-lines-per-function, complexity -- presentational JSX of a dashboard widget; splitting it into one-use fragments would hurt readability. */
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { PageFrame } from "../components/templates/PageFrame";
import { PageHeader } from "../components/templates/PageHeader";
import { useFormatDateTime } from "../format/use-format-date-time";
import { useMe } from "../session/use-me";
import { useSessionIdentity } from "../session/use-session-identity";
import { useDocumentTitle } from "../shell/use-document-title";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { InlineNotice } from "../ui/InlineNotice";
import { KpiSkeleton } from "../ui/KpiSkeleton";
import { Refreshing } from "../ui/Refreshing";
import { DashboardChart } from "./DashboardChart";
import { DashboardFilterBar } from "./DashboardFilterBar";
import { localToday, readDashboardFilters, toDashboardSearch } from "./dashboard-filters";
import type { DashboardFilters, Period } from "./dashboard-filters";
import { dashboardOptions } from "./dashboard-query";
import type { DashboardKind } from "./dashboard-query";
import { IndicatorCards } from "./IndicatorCards";
import { useDashboardText } from "./use-dashboard-text";

interface DashboardPageProps {
  kind: DashboardKind;
  title: string;
  description: string;
  defaultPeriod: Period;
  /** Charts that span the full width of the page (others share two columns). */
  wideCharts?: readonly string[];
}

/** Shared body of W53, W54 and W55: filters in the URL, KPI cards, charts, each with its table. */
export function DashboardPage(props: DashboardPageProps) {
  const { kind, title, description, defaultPeriod, wideCharts = [] } = props;
  const { t } = useTranslation();
  const text = useDashboardText();
  const formatDateTime = useFormatDateTime();
  useDocumentTitle(title);
  const client = useApiClient();
  const identity = useSessionIdentity();
  const timeZone = useMe().organization?.timezone ?? "UTC";
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const filters = readDashboardFilters(search, defaultPeriod);
  const query = useQuery(
    dashboardOptions(client, identity, { kind, filters, today: localToday(timeZone) }),
  );
  const change = (next: DashboardFilters) => {
    void navigate({ to: ".", search: toDashboardSearch(next, defaultPeriod), replace: true });
  };
  const dashboard = query.data;
  return (
    <PageFrame>
      <PageHeader
        title={title}
        description={description}
        actions={
          dashboard ? (
            <span className="text-xs font-medium text-ink-3">
              {t("analytics.cutoff", { date: formatDateTime(dashboard.cutoff) })}
            </span>
          ) : undefined
        }
      />
      <DashboardFilterBar filters={filters} defaultPeriod={defaultPeriod} onChange={change} />
      {query.isFetching && dashboard && <Refreshing />}
      {dashboard === undefined && query.isError && (
        <div className="rounded-2xl border border-line bg-surface shadow-card">
          <ErrorState
            message={t("analytics.state.loadError")}
            onRetry={() => {
              void query.refetch();
            }}
          />
        </div>
      )}
      {dashboard === undefined && !query.isError && (
        <>
          <KpiSkeleton cells={4} />
          <CardSkeleton announce={false} />
        </>
      )}
      {dashboard && (
        <>
          {dashboard.notes.map((note) => (
            <InlineNotice key={note.code + JSON.stringify(note.params)} tone="info">
              <p>{text.label(note)}</p>
            </InlineNotice>
          ))}
          <IndicatorCards indicators={dashboard.indicators} label={t("analytics.kpi.label")} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {dashboard.charts.map((chart) => (
              <div
                key={chart.key}
                className={wideCharts.includes(chart.key) ? "min-w-0 xl:col-span-2" : "min-w-0"}
              >
                <DashboardChart chart={chart} granularity={filters.granularity} />
              </div>
            ))}
          </div>
        </>
      )}
    </PageFrame>
  );
}
