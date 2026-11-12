/* eslint-disable max-lines-per-function, complexity -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { useQuery } from "@tanstack/react-query";
import { LineChart } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../../api/ApiClientProvider";
import { PageFrame } from "../../components/templates/PageFrame";
import { PageHeader } from "../../components/templates/PageHeader";
import { FilterBar } from "../../data-table/FilterBar";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { useFormatCalendarDate } from "../../format/use-formatters";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { can } from "../../session/can";
import { useMe } from "../../session/use-me";
import { useSessionIdentity } from "../../session/use-session-identity";
import { useDocumentTitle } from "../../shell/use-document-title";
import { Card } from "../../ui/Card";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { ErrorState } from "../../ui/ErrorState";
import { InlineNotice } from "../../ui/InlineNotice";
import { Refreshing } from "../../ui/Refreshing";
import { StateFrame } from "../../ui/StateFrame";
import { ComparisonChart } from "./ComparisonChart";
import { ComparisonTable } from "./ComparisonTable";
import {
  INDICATOR_PERMISSION,
  INDICATORS,
  comparisonOptions,
  comparisonTable,
  requestOf,
} from "./comparison-query";

/** W56: one indicator across quadrants or centers, as bars and the same data as a table. */
export function ComparisonPage() {
  const { t } = useTranslation();
  const me = useMe();
  const client = useApiClient();
  const identity = useSessionIdentity();
  const formatDateTime = useFormatDateTime();
  const formatDay = useFormatCalendarDate();
  useDocumentTitle(t("comparison.title"));
  const allowed = useMemo(
    () => INDICATORS.filter((indicator) => can(me, INDICATOR_PERMISSION[indicator])),
    [me],
  );
  const table = useMemo(() => comparisonTable(allowed), [allowed]);
  const controller = useTableUrlState(table);
  const request = requestOf(controller.state, allowed);
  const query = useQuery({
    ...comparisonOptions(client, identity, request),
    enabled: identity.isSettled && allowed.length > 0,
  });
  const comparison = query.data;
  const title = t(
    request.group === "quadrant"
      ? "comparison.chart.titleQuadrant"
      : "comparison.chart.titleCenter",
    { indicator: t(`comparison.indicator.${request.indicator}`) },
  );
  return (
    <PageFrame>
      <PageHeader
        title={t("comparison.title")}
        description={t("comparison.description")}
        actions={
          comparison ? (
            <span className="text-xs font-medium text-ink-3">
              {t("comparison.cutoff", { date: formatDateTime(comparison.cutoff) })}
            </span>
          ) : undefined
        }
      />
      <FilterBar controller={controller} />
      {query.isFetching && comparison && <Refreshing />}
      {query.isError && comparison === undefined && (
        <div className="rounded-2xl border border-line bg-surface shadow-card">
          <ErrorState
            message={t("comparison.error")}
            onRetry={() => {
              void query.refetch();
            }}
          />
        </div>
      )}
      {comparison === undefined && !query.isError && <CardSkeleton announce={false} />}
      {comparison && comparison.rows.length === 0 && (
        <Card title={title} headingLevel={2}>
          <StateFrame icon={LineChart} message={t("comparison.empty")}>
            <p className="m-0 text-[13px] text-ink-2">{t("comparison.emptyHint")}</p>
          </StateFrame>
        </Card>
      )}
      {comparison && comparison.rows.length > 0 && (
        <>
          <Card title={title} headingLevel={2}>
            <div className="flex flex-col gap-4">
              <ComparisonChart
                rows={comparison.rows}
                unit={comparison.unit}
                ariaLabel={t("comparison.chart.aria", { title })}
              />
              {comparison.group_by === "quadrant" && (
                <p className="m-0 text-xs text-ink-2">{t("comparison.chart.legendCenter")}</p>
              )}
              <ComparisonTable comparison={comparison} indicator={request.indicator} />
            </div>
          </Card>
          <InlineNotice tone="info">
            <p>
              {t("comparison.note", {
                from: formatDay(comparison.previous_from),
                to: formatDay(comparison.previous_to),
              })}
            </p>
          </InlineNotice>
        </>
      )}
    </PageFrame>
  );
}
